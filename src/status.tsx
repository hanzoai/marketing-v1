// A state on a palette with no hues. Luminance carries degree: settled is
// brightest, in motion is middle, at rest is dimmest. Beside its word, always.

import { Text, XStack, YStack } from '@hanzo/ui'

export type Tone = 'up' | 'moving' | 'quiet' | 'act'

const ink = { up: '$ink', moving: '$soft', quiet: '$quiet', act: '$ink' } as const

export function tone(status: string): Tone {
  if (status === 'active' || status === 'published' || status === 'completed') return 'up'
  if (status === 'scheduled') return 'moving'
  if (status === 'failed') return 'act'
  return 'quiet'
}

export function Mark({ of, says }: { of: Tone; says: string }) {
  const filled = of !== 'quiet'
  return (
    <XStack items="center" gap="$2">
      <YStack
        width={6}
        height={6}
        rounded={999}
        bg={filled ? ink[of] : 'transparent'}
        borderWidth={1}
        borderColor={ink[of]}
      />
      <Text fontSize="$1" color={ink[of]} fontWeight={of === 'act' ? '500' : '400'}>
        {says}
      </Text>
    </XStack>
  )
}
