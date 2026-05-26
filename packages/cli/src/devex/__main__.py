"""devex CLI entry point.

This module wires together all subcommands and is exposed as the `devex`
console script via [project.scripts] in pyproject.toml.
"""

from __future__ import annotations

import re
from pathlib import Path

import git
import typer
from pydantic import ValidationError
from rich.console import Console
from rich.markup import escape

from devex import __version__
from devex.audit import (
    CollectorError as AuditCollectorError,
)
from devex.audit import (
    build_event as build_audit_event,
)
from devex.audit import (
    emit_to_collector as emit_audit_to_collector,
)
from devex.audit import (
    emit_to_stdout as emit_audit_to_stdout,
)
from devex.check import (
    CheckLabel,
    resolve_check_commands,
    run_all,
)
from devex.contracts import AuditAction, Stage, Status
from devex.dora import CollectorError, build_event, emit_to_collector, emit_to_stdout
from devex.hooks import (
    HookResult,
    InstallOutcome,
    UninstallOutcome,
    install_pre_push,
    install_prepare_commit_msg,
    uninstall_pre_push,
    uninstall_prepare_commit_msg,
)
from devex.init import ScaffoldContext, WriteOutcome, files_for_profile, write_files
from devex.validation import (
    DEFAULT_WORK_ID_PATTERN,
    NotAGitRepoError,
    ValidationIssue,
    commit_messages,
    current_branch,
    detect_origin_url,
    inject_work_id,
    open_repo,
    validate_branch,
    validate_commits,
    validate_pr_title,
)

FRAMEWORK_VERSION = "0.1.0"

app = typer.Typer(
    name="devex",
    help="DevEx CLI — Golden Path tooling for polyglot engineering teams.",
    no_args_is_help=True,
    add_completion=False,
)

console = Console()
err_console = Console(stderr=True)


def _version_callback(value: bool) -> None:
    if value:
        console.print(f"devex {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        None,
        "--version",
        "-V",
        callback=_version_callback,
        is_eager=True,
        help="Show the installed devex version and exit.",
    ),
) -> None:
    """devex — Golden Path CLI."""


@app.command()
def validate(
    branch: bool = typer.Option(
        True,
        "--branch/--no-branch",
        help="Validate the current Git branch name.",
    ),
    commits: bool = typer.Option(
        True,
        "--commits/--no-commits",
        help="Validate Work IDs in commit messages between base-ref and HEAD.",
    ),
    pr_title: str | None = typer.Option(
        None,
        "--pr-title",
        envvar="GITHUB_PR_TITLE",
        help="PR title to validate (also read from GITHUB_PR_TITLE env var).",
    ),
    pattern: str = typer.Option(
        DEFAULT_WORK_ID_PATTERN,
        "--pattern",
        envvar="DEVEX_WORK_ID_PATTERN",
        help="Regex pattern for Work IDs.",
    ),
    base_ref: str = typer.Option(
        "origin/main",
        "--base-ref",
        # TODO(post-PoC): accept DEVEX_BASE_REF env var for parity with --pattern.
        # TODO(post-PoC): auto-detect the default branch (main vs master) by
        # reading `git symbolic-ref refs/remotes/origin/HEAD` instead of
        # hardcoding 'origin/main'.
        help="Git ref to use as the base for the commit range.",
    ),
) -> None:
    """Validate Work ID conventions across branch, commits, and PR title.

    Exit codes: 0 = all OK; 1 = violations found; 2 = usage / environment error.
    """
    regex = re.compile(pattern)
    issues: list[ValidationIssue] = []
    checks_enabled: list[str] = []

    try:
        repo = open_repo()
    except NotAGitRepoError as exc:
        err_console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(code=2) from exc

    if branch:
        checks_enabled.append("branch")
        br = current_branch(repo)
        if br is None:
            err_console.print(
                "[yellow]warning:[/yellow] HEAD is detached — skipping branch validation"
            )
        else:
            issue = validate_branch(br, regex)
            if issue is not None:
                issues.append(issue)

    if commits:
        checks_enabled.append("commits")
        # TODO(post-PoC): distinguish "commits validated" from "commits attempted
        # but skipped due to env" — currently both end up in checks_enabled, so
        # the OK message says "passed (commits)" even when nothing ran.
        try:
            msgs = commit_messages(repo, base_ref=base_ref)
        except git.GitCommandError as exc:
            err_console.print(
                f"[yellow]warning:[/yellow] cannot walk commits '{base_ref}..HEAD' "
                f"({exc.stderr.strip() if exc.stderr else exc}); skipping commit validation"
            )
        else:
            issues.extend(validate_commits(msgs, regex))

    if pr_title is not None:
        checks_enabled.append("pr-title")
        issue = validate_pr_title(pr_title, regex)
        if issue is not None:
            issues.append(issue)

    if not checks_enabled:
        err_console.print(
            "[yellow]warning:[/yellow] no validations enabled — pass at least one of "
            "--branch, --commits, or --pr-title to validate something"
        )
        raise typer.Exit(code=2)

    if not issues:
        console.print(
            f"[green]OK[/green] All Work ID validations passed "
            f"({', '.join(checks_enabled)})."
        )
        return

    for issue in issues:
        console.print(f"[red]X[/red] {escape(issue.render())}")
    raise typer.Exit(code=1)


def _resolve_service_name(provided: str | None) -> str:
    """Service name from `--service-name` or fall back to the cwd folder name.

    Errors out (Exit 2) if the cwd has no usable name (e.g., we're at `/`).
    """
    if provided is not None:
        return provided

    inferred = Path.cwd().name
    if not inferred:
        err_console.print(
            "[red]error:[/red] could not infer service name from the current "
            "directory; pass --service-name explicitly."
        )
        raise typer.Exit(code=2)

    console.print(f"[dim]Inferred service name from directory: '{inferred}'[/dim]")
    return inferred


def _resolve_repo_url(provided: str | None, service_name: str) -> str:
    """Layered resolution for the consumer repo URL.

    1. The `--repo-url` flag if provided.
    2. The `origin` remote URL (normalized to https://) if we're inside a
       Git repo that has one configured.
    3. A TODO placeholder, with a noisy stderr warning.
    """
    if provided is not None:
        return provided

    try:
        repo = open_repo()
        detected = detect_origin_url(repo)
    except NotAGitRepoError:
        detected = None

    if detected is not None:
        console.print(f"[dim]Using detected remote: {detected}[/dim]")
        return detected

    placeholder = f"https://github.com/TODO-org/{service_name}"
    err_console.print(
        f"[yellow]warning:[/yellow] no --repo-url provided and no 'origin' "
        f"remote configured; using placeholder '{placeholder}'. "
        "Edit devex.profile.ts before pushing."
    )
    return placeholder


@app.command()
def init(
    profile: str = typer.Option(
        "python-lambda-api",
        "--profile",
        "-p",
        help="Stack profile to scaffold.",
    ),
    service_name: str | None = typer.Option(
        None,
        "--service-name",
        help=(
            "Service name. If omitted, inferred from the current directory name "
            "(repo and service typically share a name)."
        ),
    ),
    team: str = typer.Option(
        ...,
        "--team",
        help="Owning team slug (matches finops:Team tag).",
    ),
    repo_url: str | None = typer.Option(
        None,
        "--repo-url",
        help=(
            "Git repository URL. If omitted, auto-detect from the 'origin' "
            "remote; if no remote is configured, use a TODO placeholder."
        ),
    ),
    work_id_pattern: str = typer.Option(
        DEFAULT_WORK_ID_PATTERN,
        "--work-id-pattern",
        help="Regex for Work IDs (e.g. 'FIN-[0-9]+').",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        help="Overwrite existing files instead of skipping them.",
    ),
    dry_run: bool = typer.Option(
        False,
        "--dry-run",
        help="Show what would be written without touching the filesystem.",
    ),
    strict_tags: bool = typer.Option(
        False,
        "--strict-tags",
        help=(
            "Scaffold the profile with `tagSeverity: 'error'` so missing FinOps "
            "tags fail `cdk synth` instead of merely warning. Use for production "
            "stacks or teams ready for day-1 enforcement."
        ),
    ),
) -> None:
    """Scaffold the Golden Path in the current repository."""
    resolved_service_name = _resolve_service_name(service_name)
    resolved_repo_url = _resolve_repo_url(repo_url, resolved_service_name)
    ctx = ScaffoldContext(
        service_name=resolved_service_name,
        team=team,
        repo_url=resolved_repo_url,
        work_id_pattern=work_id_pattern,
        strict_tags=strict_tags,
    )

    try:
        files = files_for_profile(profile, ctx)
    except ValueError as exc:
        err_console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(code=2) from exc

    results = write_files(Path.cwd(), files, force=force, dry_run=dry_run)

    created = [r for r in results if r.outcome == WriteOutcome.CREATED]
    overwritten = [r for r in results if r.outcome == WriteOutcome.OVERWRITTEN]
    skipped = [r for r in results if r.outcome == WriteOutcome.SKIPPED_EXISTS]

    for result in results:
        rel = result.path.relative_to(Path.cwd())
        if result.outcome == WriteOutcome.CREATED:
            console.print(f"[green]+[/green] {rel}")
        elif result.outcome == WriteOutcome.OVERWRITTEN:
            console.print(f"[yellow]~[/yellow] {rel} (overwritten)")
        elif result.outcome == WriteOutcome.SKIPPED_EXISTS:
            console.print(f"[dim]= {rel} (exists, use --force to overwrite)[/dim]")
        elif result.outcome == WriteOutcome.DRY_RUN:
            console.print(f"[cyan]?[/cyan] {rel} (would create)")

    # Exit 1 only on PARTIAL state — some files written, some left alone. Full
    # idempotent re-runs (everything skipped) exit 0, matching UNIX tooling
    # conventions (cp --no-clobber, mkdir -p, git init).
    made_changes = bool(created or overwritten)
    if skipped and made_changes:
        err_console.print(
            f"[yellow]warning:[/yellow] {len(skipped)} file(s) skipped while "
            f"{len(created) + len(overwritten)} were written — partial state. "
            "Re-run with --force or remove the skipped files to converge."
        )
        raise typer.Exit(code=1)


@app.command()
def check(
    lint: list[str] = typer.Option(
        [],
        "--lint",
        help="Lint command to run (repeatable). Overrides values parsed from devex.profile.ts.",
    ),
    test: str | None = typer.Option(
        None,
        "--test",
        help="Test command to run. Overrides value parsed from devex.profile.ts.",
    ),
    profile_path: Path = typer.Option(
        Path("devex.profile.ts"),
        "--profile-path",
        help="Path to the devex.profile.ts file to parse.",
    ),
) -> None:
    """Run pre-push lint and test commands from devex.profile.ts (or explicit flags).

    Source precedence: --test/--lint flags > parsed devex.profile.ts. If neither
    is configured, the command is a no-op (exit 0).
    """
    commands = resolve_check_commands(
        profile_path,
        explicit_test=test,
        explicit_lint=lint,
    )

    if not commands.test_command and not commands.lint_commands:
        if profile_path.exists() and (test is None and not lint):
            err_console.print(
                f"[yellow]warning:[/yellow] could not parse "
                f"testCommand/lintCommands from {profile_path}. "
                "Pass --test/--lint explicitly or re-run `devex init`."
            )
        else:
            console.print(
                "[dim]No check commands configured — nothing to run.[/dim]"
            )
        return

    results = run_all(commands.lint_commands, commands.test_command)

    failed = [r for r in results if not r.passed]
    if failed:
        for r in failed:
            err_console.print(
                f"[red]X[/red] {r.label.value} failed (exit {r.exit_code}): {r.command}"
            )
        raise typer.Exit(code=1)

    lint_count = sum(1 for r in results if r.label is CheckLabel.LINT)
    test_count = sum(1 for r in results if r.label is CheckLabel.TEST)
    console.print(
        f"[green]OK[/green] All checks passed "
        f"(lint: {lint_count}, test: {test_count})."
    )


hooks_app = typer.Typer(help="Manage devex-managed Git hooks.")
app.add_typer(hooks_app, name="hooks")


def _resolve_repo_root() -> Path:
    repo = open_repo()  # raises NotAGitRepoError handled by caller
    return Path(repo.working_tree_dir) if repo.working_tree_dir else Path(repo.git_dir).parent


def _report_install(result: HookResult) -> bool:
    """Print the outcome of an install_* call. Returns True if anything refused."""
    if result.outcome == InstallOutcome.INSTALLED:
        console.print(f"[green]OK[/green] Installed {result.name} hook at {result.path}")
    elif result.outcome == InstallOutcome.REPLACED_DEVEX_HOOK:
        console.print(
            f"[green]OK[/green] Re-installed devex-managed {result.name} hook at {result.path}"
        )
    elif result.outcome == InstallOutcome.OVERWROTE_FOREIGN:
        console.print(
            f"[yellow]warning:[/yellow] Overwrote a non-devex {result.name} hook at {result.path}"
        )
    elif result.outcome == InstallOutcome.REFUSED_EXISTING:
        err_console.print(
            f"[red]error:[/red] A non-devex {result.name} hook already exists at {result.path}. "
            "Back it up and re-run with --force to overwrite."
        )
        return True
    return False


def _report_uninstall(result: HookResult) -> bool:
    """Print the outcome of an uninstall_* call. Returns True if foreign hook found."""
    if result.outcome == UninstallOutcome.REMOVED:
        console.print(f"[green]OK[/green] Removed devex {result.name} hook from {result.path}")
    elif result.outcome == UninstallOutcome.SKIPPED_NOT_PRESENT:
        console.print(f"[dim]No {result.name} hook installed at {result.path}[/dim]")
    elif result.outcome == UninstallOutcome.SKIPPED_NOT_DEVEX:
        err_console.print(
            f"[yellow]warning:[/yellow] {result.name} hook at {result.path} is NOT "
            "devex-managed; refusing to delete. Remove it manually if needed."
        )
        return True
    return False


@hooks_app.command("install")
def hooks_install(
    force: bool = typer.Option(
        False,
        "--force",
        help="Overwrite existing non-devex hooks (back them up first).",
    ),
    auto_inject: bool = typer.Option(
        False,
        "--auto-inject",
        help="Also install prepare-commit-msg that prepends Work IDs from the "
        "branch name to commit messages that lack one.",
    ),
    with_checks: bool = typer.Option(
        False,
        "--with-checks",
        help="Run `devex check` (lint + test from devex.profile.ts) as part of "
        "the pre-push hook. Stops the push on lint/test failure.",
    ),
) -> None:
    """Install devex-managed Git hooks in the current repository."""
    try:
        repo_root = _resolve_repo_root()
    except NotAGitRepoError as exc:
        err_console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(code=2) from exc

    refused = False
    refused |= _report_install(
        install_pre_push(repo_root, force=force, with_checks=with_checks)
    )
    if auto_inject:
        refused |= _report_install(install_prepare_commit_msg(repo_root, force=force))

    if refused:
        raise typer.Exit(code=1)


@hooks_app.command("uninstall")
def hooks_uninstall() -> None:
    """Remove all devex-managed Git hooks (preserves custom hooks)."""
    try:
        repo_root = _resolve_repo_root()
    except NotAGitRepoError as exc:
        err_console.print(f"[red]error:[/red] {exc}")
        raise typer.Exit(code=2) from exc

    foreign = False
    foreign |= _report_uninstall(uninstall_pre_push(repo_root))
    foreign |= _report_uninstall(uninstall_prepare_commit_msg(repo_root))

    if foreign:
        raise typer.Exit(code=1)


@hooks_app.command("commit-msg-inject", hidden=True)
def hooks_commit_msg_inject(
    msg_file: Path = typer.Argument(
        ...,
        help="Commit message file (provided by Git's prepare-commit-msg hook).",
    ),
    source: str = typer.Argument(
        "",
        help="Source of the message: 'message', 'template', 'merge', 'squash', 'commit'.",
    ),
    pattern: str = typer.Option(
        DEFAULT_WORK_ID_PATTERN,
        "--pattern",
        envvar="DEVEX_WORK_ID_PATTERN",
        help="Regex pattern for Work IDs.",
    ),
) -> None:
    """Inject the branch's Work ID into a commit message that lacks one.

    Designed to be invoked by Git's `prepare-commit-msg` hook. No-op (exit 0)
    when injection is unnecessary or impossible — the hook must never block
    `git commit` on its own.
    """
    # Merge and squash messages are user-curated or auto-generated; never
    # touch them.
    if source in {"merge", "squash"}:
        return

    if not msg_file.exists():
        return

    try:
        repo = open_repo()
    except NotAGitRepoError:
        return  # ran outside a repo; nothing to do

    branch = current_branch(repo)
    current = msg_file.read_text()
    regex = re.compile(pattern)

    rewritten = inject_work_id(current, branch, regex)
    if rewritten is None:
        return

    msg_file.write_text(rewritten)
    err_console.print(
        f"[dim]devex: injected Work ID from branch '{branch}' into commit message[/dim]"
    )


dora_app = typer.Typer(help="Emit DORA telemetry events.")
app.add_typer(dora_app, name="dora")


@dora_app.command("emit")
def dora_emit(
    stage: Stage = typer.Option(..., "--stage", help="Pipeline stage being reported."),
    status: Status = typer.Option(..., "--status", help="Stage outcome."),
    work_id: str = typer.Option(
        ..., "--work-id", envvar="DEVEX_WORK_ID", help="Work ID (e.g. FIN-123)."
    ),
    team: str = typer.Option(..., "--team", envvar="DEVEX_TEAM", help="Owning team slug."),
    repo: str = typer.Option(
        ..., "--repo", envvar="DEVEX_REPO_URL", help="Repository URL of the service."
    ),
    actor: str = typer.Option(
        ..., "--actor", envvar="GITHUB_ACTOR", help="Who triggered the event."
    ),
    git_sha: str = typer.Option(
        ..., "--git-sha", envvar="GITHUB_SHA", help="Commit SHA being acted upon."
    ),
    duration_ms: int | None = typer.Option(
        None, "--duration-ms", help="Duration of the stage in milliseconds."
    ),
    reason: str | None = typer.Option(
        None, "--reason", help="Free-text reason (required for non-success outcomes)."
    ),
    collector_url: str | None = typer.Option(
        None,
        "--collector-url",
        envvar="DEVEX_DORA_COLLECTOR",
        help="POST the event here. If omitted, prints JSON to stdout.",
    ),
) -> None:
    """Emit a structured DORA event matching DoraEventSchema."""
    try:
        event = build_event(
            work_id=work_id,
            team=team,
            repo=repo,
            stage=stage,
            status=status,
            actor=actor,
            git_sha=git_sha,
            duration_ms=duration_ms,
            reason=reason,
            framework_version=FRAMEWORK_VERSION,
        )
    except ValidationError as exc:
        err_console.print("[red]error:[/red] invalid DORA event payload:")
        err_console.print(escape(str(exc)))
        raise typer.Exit(code=1) from exc

    if collector_url:
        try:
            emit_to_collector(event, collector_url)
        except CollectorError as exc:
            err_console.print(f"[red]error:[/red] {exc}")
            raise typer.Exit(code=1) from exc
        console.print(
            f"[green]OK[/green] Posted DORA event for {event.work_id} → {collector_url}"
        )
    else:
        # Print JSON to stdout — pipe-friendly for log aggregators.
        typer.echo(emit_to_stdout(event))


audit_app = typer.Typer(help="Emit SOC 2 audit events.")
app.add_typer(audit_app, name="audit")


@audit_app.command("emit")
def audit_emit(
    action: AuditAction = typer.Option(..., "--action", help="Audit action being recorded."),
    target: str = typer.Option(
        ..., "--target", help="What was acted upon (env name, resource, PR number)."
    ),
    reason: str = typer.Option(
        ..., "--reason", help="Why the action happened (SOC 2 requires a justification)."
    ),
    work_id: str = typer.Option(
        ..., "--work-id", envvar="DEVEX_WORK_ID", help="Work ID (e.g. FIN-123)."
    ),
    team: str = typer.Option(..., "--team", envvar="DEVEX_TEAM", help="Owning team slug."),
    repo: str = typer.Option(
        ..., "--repo", envvar="DEVEX_REPO_URL", help="Repository URL of the service."
    ),
    actor: str = typer.Option(
        ..., "--actor", envvar="GITHUB_ACTOR", help="Who triggered the event."
    ),
    git_sha: str = typer.Option(
        ..., "--git-sha", envvar="GITHUB_SHA", help="Commit SHA being acted upon."
    ),
    collector_url: str | None = typer.Option(
        None,
        "--collector-url",
        envvar="DEVEX_AUDIT_COLLECTOR",
        help="POST the event here. If omitted, prints JSON to stdout.",
    ),
) -> None:
    """Emit a structured SOC 2 audit event matching AuditEventSchema."""
    try:
        event = build_audit_event(
            work_id=work_id,
            team=team,
            repo=repo,
            action=action,
            target=target,
            reason=reason,
            actor=actor,
            git_sha=git_sha,
            framework_version=FRAMEWORK_VERSION,
        )
    except ValidationError as exc:
        err_console.print("[red]error:[/red] invalid audit event payload:")
        err_console.print(escape(str(exc)))
        raise typer.Exit(code=1) from exc

    if collector_url:
        try:
            emit_audit_to_collector(event, collector_url)
        except AuditCollectorError as exc:
            err_console.print(f"[red]error:[/red] {exc}")
            raise typer.Exit(code=1) from exc
        console.print(
            f"[green]OK[/green] Posted audit event ({event.action.value}) → {collector_url}"
        )
    else:
        typer.echo(emit_audit_to_stdout(event))


if __name__ == "__main__":
    app()
