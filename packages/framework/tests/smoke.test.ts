import { FRAMEWORK_VERSION } from '../src/index'

describe('@devex/framework — smoke', () => {
  it('exports a version constant', () => {
    expect(FRAMEWORK_VERSION).toBe('0.1.0')
  })
})
