// The parts every screen shares: heading, signed-out state, controls, lists,
// and how a refusal reads.

import { useState, type ReactNode } from 'react'
import { useIam } from '@hanzo/iam/react'
import { Box, Text, XStack, YStack } from '@hanzo/ui'

import { enter } from '~/enter'
import { useTenant } from '~/client'
import { why, type Read } from '~/marketing'

export function Screen({
  title,
  says,
  beside,
  children,
}: {
  title: string
  says: string
  beside?: ReactNode
  children: ReactNode
}) {
  return (
    <YStack flex={1} minH={0} gap="$4" p="$5">
      <XStack items="flex-start" gap="$3" flexWrap="wrap">
        <YStack gap="$1" flex={1} minW={220}>
          <Text render="h1" fontSize="$6" fontWeight="600" color="$ink">
            {title}
          </Text>
          <Text fontSize="$2" color="$soft">
            {says}
          </Text>
        </YStack>
        {beside}
      </XStack>
      {children}
    </YStack>
  )
}

export function Heading({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="$3" fontWeight="500" color="$ink">
      {children}
    </Text>
  )
}

/**
 * A button. `loud` inverts it — the palette's loudest mark, used once per
 * screen. `on` marks the selected one of a set by its border.
 */
export function Act({
  onPress,
  children,
  disabled,
  loud,
  on,
}: {
  onPress: () => void
  children: ReactNode
  disabled?: boolean
  loud?: boolean
  on?: boolean
}) {
  return (
    <Box
      render="button"
      onClick={disabled ? undefined : onPress}
      aria-disabled={disabled}
      aria-pressed={on}
      px="$3"
      py="$2"
      rounded="$3"
      borderWidth={1}
      borderColor={loud || on ? '$ink' : '$borderColor'}
      bg={loud ? '$ink' : on ? '$hover' : 'transparent'}
      opacity={disabled ? 0.4 : 1}
      hoverStyle={disabled ? {} : { bg: loud ? '$ink' : '$hover' }}
    >
      <Text fontSize="$2" color={loud ? '$background' : '$ink'} fontWeight={loud ? '500' : '400'}>
        {children}
      </Text>
    </Box>
  )
}

const box = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '6px 10px',
  outline: 'none',
  color: 'inherit',
  font: 'inherit',
  fontSize: 13,
  minWidth: 0,
} as const

export function Field({
  value,
  set,
  hint,
  type = 'text',
  width,
}: {
  value: string
  set: (v: string) => void
  hint: string
  type?: string
  width?: number
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={hint}
      aria-label={hint}
      onChange={(e) => set(e.target.value)}
      style={{ ...box, flex: width ? undefined : 1, width }}
    />
  )
}

export function Choice({
  value,
  set,
  of,
  hint,
  name = (v) => v,
}: {
  value: string
  set: (v: string) => void
  of: readonly string[]
  hint: string
  name?: (v: string) => string
}) {
  return (
    <select value={value} aria-label={hint} onChange={(e) => set(e.target.value)} style={box}>
      {of.map((v) => (
        <option key={v} value={v}>
          {name(v)}
        </option>
      ))}
    </select>
  )
}

export function Words({ value, set, hint }: { value: string; set: (v: string) => void; hint: string }) {
  return (
    <textarea
      value={value}
      placeholder={hint}
      aria-label={hint}
      rows={4}
      onChange={(e) => set(e.target.value)}
      style={{ ...box, resize: 'vertical' }}
    />
  )
}

/** A write in flight: one at a time, and the platform's refusal if it said no. */
export function useRun() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const run = async (go: () => Promise<unknown>, then?: () => void) => {
    if (busy) return
    setBusy(true)
    setFailed(null)
    try {
      await go()
      then?.()
    } catch (e) {
      setFailed(why(e))
    } finally {
      setBusy(false)
    }
  }
  return { busy, failed, run }
}

export function Refusal({ says }: { says: string | null }) {
  return says ? (
    <Text fontSize="$1" color="$ink" fontWeight="500">
      {says}
    </Text>
  ) : null
}

export function Failed({ what, why }: { what: string; why: string }) {
  return (
    <YStack gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <Text fontSize="$2" color="$ink">
        Could not load {what}.
      </Text>
      <Text fontSize="$1" color="$soft">
        {why}
      </Text>
    </YStack>
  )
}

export function Nothing({ says }: { says: string }) {
  return (
    <YStack items="center" justify="center" p="$6">
      <Text fontSize="$2" color="$quiet" text="center">
        {says}
      </Text>
    </YStack>
  )
}

/** One figure the platform returned, and what it is. */
export function Count({ of, says }: { of: ReactNode; says: string }) {
  return (
    <YStack gap="$1" p="$3" rounded="$3" borderWidth={1} borderColor="$borderColor" flex={1} minW={140}>
      <Text fontSize="$7" fontWeight="600" color="$ink">
        {of ?? '—'}
      </Text>
      <Text fontSize="$1" color="$soft">
        {says}
      </Text>
    </YStack>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <XStack items="center" gap="$3" py="$3" flexWrap="wrap" borderBottomWidth={1} borderColor="$borderColor">
      {children}
    </XStack>
  )
}

/** A list read: its failure, nothing while loading, its empty state, or its rows. */
export function List<T>({
  read,
  what,
  none,
  children,
}: {
  read: Read<T[]>
  what: string
  none: string
  children: (rows: T[]) => ReactNode
}) {
  if (read.failed) return <Failed what={what} why={read.failed} />
  if (!read.it) return null
  if (!read.it.length) return <Nothing says={none} />
  return <YStack>{children(read.it)}</YStack>
}

/** The screen, once someone is signed in and working in one organization. */
export function Ready({ children }: { children: ReactNode }) {
  const door = useIam()
  const { org, orgs } = useTenant()
  const { isAuthenticated, isLoading } = door

  if (isLoading) return <YStack flex={1} />

  if (!isAuthenticated) {
    return (
      <YStack flex={1} items="center" justify="center" gap="$3" p="$6">
        <Text render="h1" fontSize="$6" fontWeight="600" color="$ink">
          Hanzo Marketing
        </Text>
        <Text fontSize="$2" color="$soft" text="center" maxW={420}>
          Email sequences that follow each customer from the day they arrive, sent
          on the delays you set.
        </Text>
        <Act onPress={() => void enter(door)} loud>
          Sign in
        </Act>
      </YStack>
    )
  }

  if (!org && orgs.length > 1) {
    return (
      <YStack flex={1} items="center" justify="center" gap="$2" p="$6">
        <Text fontSize="$3" color="$ink">
          Pick an organization
        </Text>
        <Text fontSize="$2" color="$soft" text="center" maxW={420}>
          Sequences, audiences and campaigns belong to one organization. Choose it at
          the bottom of the column on the left.
        </Text>
      </YStack>
    )
  }

  return <>{children}</>
}
