// One sequence: its steps in send order, who is enrolled, and where each person
// is. Steps append only; the platform has no edit or delete for a step.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'
import { Link, useParams } from 'react-router'

import { Act, Choice, Field, Heading, List, Nothing, Ready, Refusal, Row, Screen, Failed, Words, useRun } from '~/page'
import { Mark, tone } from '~/status'
import { delay, since } from '~/time'
import { useHttp } from '~/client'
import {
  SEQUENCE_STATES,
  addStep,
  cancelEnrollment,
  enroll,
  setSequenceStatus,
  useAudiences,
  useEnrollments,
  useSequence,
  type EnrollResult,
  type Read,
  type Enrollment,
  type Sequence as Seq,
  type Step,
} from '~/marketing'

const UNITS = { minutes: 60, hours: 3600, days: 86400 } as const
type Unit = keyof typeof UNITS

const panel = { gap: '$2', p: '$3', rounded: '$3', borderWidth: 1, borderColor: '$borderColor' } as const

function Steps({ id, steps, again }: { id: string; steps: Step[]; again: () => void }) {
  const http = useHttp()
  const [amount, setAmount] = useState('1')
  const [unit, setUnit] = useState<Unit>('days')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const { busy, failed, run } = useRun()
  const delaySeconds = Math.max(0, Math.round(Number(amount) || 0)) * UNITS[unit]

  const add = () =>
    run(
      () => addStep(http!, id, { delaySeconds, subject: subject.trim(), body }),
      () => {
        setSubject('')
        setBody('')
        again()
      },
    )

  return (
    <YStack gap="$3">
      <Heading>Steps</Heading>
      {steps.length === 0 ? <Nothing says="No steps yet. Add the first message below." /> : null}
      {steps.map((s) => (
        <YStack key={s.id} {...panel} gap="$1">
          <Text fontSize="$1" color="$soft">
            {delay(s.delaySeconds, s.idx === 0)}
          </Text>
          <Text fontSize="$3" fontWeight="500" color="$ink">
            {s.subject || 'No subject'}
          </Text>
          <Text fontSize="$2" color="$soft" numberOfLines={3}>
            {s.body}
          </Text>
        </YStack>
      ))}

      <YStack {...panel}>
        <XStack gap="$2" items="center" flexWrap="wrap">
          <Text fontSize="$2" color="$soft">
            Send
          </Text>
          <Field type="number" value={amount} set={setAmount} hint="Wait" width={72} />
          <Choice value={unit} set={(v) => setUnit(v as Unit)} of={Object.keys(UNITS)} hint="Unit" />
          <Text fontSize="$2" color="$soft">
            after {steps.length ? 'the previous step' : 'enrollment'}
          </Text>
        </XStack>
        <Field value={subject} set={setSubject} hint="Subject" />
        <Words value={body} set={setBody} hint="Message" />
        <XStack>
          <Act loud onPress={() => void add()} disabled={busy || !body.trim()}>
            Add step
          </Act>
        </XStack>
        <Refusal says={failed} />
      </YStack>
    </YStack>
  )
}

function Enroll({ seq, again }: { seq: Seq; again: () => void }) {
  const http = useHttp()
  const audiences = useAudiences(http)
  const [address, setAddress] = useState('')
  const [audience, setAudience] = useState('')
  const [got, setGot] = useState<EnrollResult | null>(null)
  const { busy, failed, run } = useRun()
  const open = seq.status === 'active'
  const names = Object.fromEntries((audiences.it ?? []).map((a) => [a.id, a.name]))

  const add = (who: { address: string } | { audienceId: string }) =>
    run(async () => setGot(await enroll(http!, seq.id, who)), again)

  return (
    <YStack {...panel}>
      <Heading>Enroll</Heading>
      {open ? null : (
        <Text fontSize="$1" color="$quiet">
          Only an active sequence takes enrollments.
        </Text>
      )}
      <XStack gap="$2">
        <Field value={address} set={setAddress} hint="person@example.com" />
        <Act onPress={() => void add({ address: address.trim() })} disabled={!open || busy || !address.trim()}>
          Enroll
        </Act>
      </XStack>
      <XStack gap="$2" items="center">
        <Choice
          value={audience}
          set={setAudience}
          of={['', ...Object.keys(names)]}
          name={(v) => (v ? names[v]! : 'An audience')}
          hint="Audience"
        />
        <Act onPress={() => void add({ audienceId: audience })} disabled={!open || busy || !audience}>
          Enroll audience
        </Act>
      </XStack>
      {got ? (
        <Text fontSize="$1" color="$soft">
          Enrolled {got.enrolled} of {got.resolved} named; {got.alreadyEnrolled} were already in.
        </Text>
      ) : null}
      <Refusal says={failed} />
    </YStack>
  )
}

function Walks({ id, total, walks }: { id: string; total: number; walks: Read<Enrollment[]> }) {
  const http = useHttp()
  const { busy, failed, run } = useRun()

  return (
    <YStack gap="$2">
      <Heading>Enrolled</Heading>
      <Refusal says={failed} />
      <List read={walks} what="who is enrolled" none="Nobody is enrolled yet.">
        {(rows) =>
          rows.map((e) => {
            const walking = e.status === 'active'
            return (
              <Row key={e.id}>
                <YStack flex={1} minW={160} gap="$1">
                  <Text fontSize="$2" color="$ink" numberOfLines={1}>
                    {e.address}
                  </Text>
                  <Text fontSize="$1" color="$quiet">
                    {walking
                      ? `Next: step ${e.currentStep + 1} of ${total}, ${since(e.nextRunAt)}`
                      : `Enrolled ${since(e.enrolledAt)}`}
                  </Text>
                </YStack>
                <Mark of={walking ? 'moving' : tone(e.status)} says={e.status} />
                {walking ? (
                  <Act onPress={() => void run(() => cancelEnrollment(http!, id, e.id), walks.again)} disabled={busy}>
                    Stop
                  </Act>
                ) : null}
              </Row>
            )
          })
        }
      </List>
    </YStack>
  )
}

export function Sequence() {
  const { id = '' } = useParams()
  const http = useHttp()
  const view = useSequence(http, id)
  const walks = useEnrollments(http, id)
  const { busy, failed, run } = useRun()
  const seq = view.it?.sequence

  return (
    <Ready>
      <Screen
        title={seq?.name ?? 'Sequence'}
        says="Its messages in the order they send, and everyone walking through them."
        beside={
          seq ? (
            <XStack gap="$2">
              {SEQUENCE_STATES.map((s) => (
                <Act
                  key={s}
                  on={seq.status === s}
                  onPress={() => void run(() => setSequenceStatus(http!, id, s), view.again)}
                  disabled={busy || seq.status === s}
                >
                  {s === 'draft' ? 'Draft' : s === 'active' ? 'Active' : 'Archived'}
                </Act>
              ))}
            </XStack>
          ) : null
        }
      >
        <XStack gap="$3" items="center">
          <Link to="/sequences" style={{ textDecoration: 'none' }}>
            <Text fontSize="$1" color="$soft">
              All sequences
            </Text>
          </Link>
          {seq ? <Mark of={tone(seq.status)} says={seq.status} /> : null}
        </XStack>
        {view.failed ? <Failed what="this sequence" why={view.failed} /> : null}
        <Refusal says={failed} />
        {seq ? (
          <XStack gap="$5" flexWrap="wrap" items="flex-start">
            <YStack flex={3} minW={320}>
              <Steps id={id} steps={view.it!.steps} again={view.again} />
            </YStack>
            <YStack flex={2} minW={300} gap="$4">
              <Enroll seq={seq} again={walks.again} />
              <Walks id={id} total={view.it!.steps.length} walks={walks} />
            </YStack>
          </XStack>
        ) : null}
      </Screen>
    </Ready>
  )
}
