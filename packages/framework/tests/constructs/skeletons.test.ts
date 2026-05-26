// Behavior tests for GoldenPathTagsAspect.

import * as cdk from 'aws-cdk-lib'
import { App, Stack } from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'

import { GoldenPathTagsAspect, REQUIRED_TAG_KEYS } from '../../src/constructs'

describe('GoldenPathTagsAspect — construction', () => {
  it('stores custom requiredTagKeys', () => {
    const aspect = new GoldenPathTagsAspect({
      requiredTagKeys: ['finops:Team', 'finops:Owner'],
    })
    expect(aspect.requiredTagKeys).toEqual(['finops:Team', 'finops:Owner'])
  })

  it('defaults to the framework-wide REQUIRED_TAG_KEYS when no list is passed', () => {
    const aspect = new GoldenPathTagsAspect()
    expect(aspect.requiredTagKeys).toEqual(REQUIRED_TAG_KEYS)
  })

  it('defaults to warning severity (graduated rollout-friendly)', () => {
    const aspect = new GoldenPathTagsAspect()
    expect(aspect.severity).toBe('warning')
  })

  it('honors explicit severity', () => {
    expect(new GoldenPathTagsAspect({ severity: 'error' }).severity).toBe('error')
    expect(new GoldenPathTagsAspect({ severity: 'warning' }).severity).toBe('warning')
  })
})

describe('GoldenPathTagsAspect — tag enforcement', () => {
  function synthWithAspect(
    applyTags: Record<string, string>,
    severity: 'warning' | 'error' = 'error',
  ): { messages: string[] } {
    const app = new App()
    const stack = new Stack(app, 'TestStack')

    new dynamodb.Table(stack, 'TestTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    })

    for (const [k, v] of Object.entries(applyTags)) {
      cdk.Tags.of(stack).add(k, v)
    }

    cdk.Aspects.of(stack).add(new GoldenPathTagsAspect({ severity }), {
      priority: cdk.AspectPriority.READONLY,
    })

    const assembly = app.synth({ validateOnSynthesis: false })
    const targetLevel = severity
    const messages: string[] = []
    for (const stackArtifact of assembly.stacks) {
      for (const msg of stackArtifact.messages) {
        if (msg.level === targetLevel) {
          messages.push(
            typeof msg.entry.data === 'string'
              ? msg.entry.data
              : JSON.stringify(msg.entry.data),
          )
        }
      }
    }
    return { messages }
  }

  it('emits no messages when all required tags are present (error mode)', () => {
    const { messages } = synthWithAspect({
      'finops:Project': 'P',
      'finops:Service': 'S',
      'finops:Team': 'T',
      'finops:Owner': 'O',
      'project-type': 'api',
    })
    expect(messages).toEqual([])
  })

  it('emits errors for every missing required tag (error mode)', () => {
    const { messages } = synthWithAspect(
      { 'finops:Project': 'P' },
      'error',
    )
    expect(messages.length).toBeGreaterThanOrEqual(4)
    expect(messages.join('\n')).toMatch(/finops:Service/)
    expect(messages.join('\n')).toMatch(/finops:Team/)
    expect(messages.join('\n')).toMatch(/finops:Owner/)
    expect(messages.join('\n')).toMatch(/project-type/)
  })

  it('emits warnings (not errors) when severity is "warning"', () => {
    const { messages: errors } = synthWithAspect({}, 'error')
    expect(errors.length).toBeGreaterThan(0)

    const app = new App()
    const stack = new Stack(app, 'WarnStack')
    new dynamodb.Table(stack, 'TestTable', {
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
    })
    cdk.Aspects.of(stack).add(new GoldenPathTagsAspect({ severity: 'warning' }), {
      priority: cdk.AspectPriority.READONLY,
    })

    const assembly = app.synth({ validateOnSynthesis: false })
    const warnings: string[] = []
    const errs: string[] = []
    for (const stackArtifact of assembly.stacks) {
      for (const msg of stackArtifact.messages) {
        if (msg.level === 'warning') warnings.push(String(msg.entry.data))
        if (msg.level === 'error') errs.push(String(msg.entry.data))
      }
    }
    expect(warnings.length).toBeGreaterThan(0)
    expect(errs).toEqual([])
  })

  it('messages reference ADR-001 §1 for context', () => {
    const { messages } = synthWithAspect({}, 'error')
    expect(messages.join('\n')).toMatch(/ADR-001/)
  })

  it('messages include the offending resource path', () => {
    const { messages } = synthWithAspect({}, 'error')
    expect(messages.join('\n')).toMatch(/TestStack\/TestTable/)
  })
})
