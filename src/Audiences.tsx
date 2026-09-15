// Who a sequence can reach. An audience with no event is everyone in the
// organization; with one, the people who fired it recently. Saved audiences are
// not editable — save another.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { Act, Count, Failed, Field, List, Ready, Refusal, Row, Screen, useRun } from '~/page'
import { since } from '~/time'
import { useHttp } from '~/client'
import { createAudience, dropAudience, useAudiences, usePreview } from '~/marketing'

function Reach({ id }: { id: string }) {
  const preview = usePreview(useHttp(), id)
  const p = preview.it
  if (preview.failed) return <Failed what="the reach" why={preview.failed} />
  if (!p) return null
  if (!p.available)
    return (
      <Text fontSize="$1" color="$quiet" pb="$3">
        Could not measure this audience: {p.reason}
      </Text>
    )
  return (
    <YStack gap="$2" pb="$3">
      <XStack gap="$3" flexWrap="wrap">
        <Count of={p.count} says="In the audience" />
        <Count of={p.deliverable} says="Mailboxes a send reaches" />
        <Count of={p.unmatched} says="With no address on file" />
      </XStack>
      <Text fontSize="$1" color="$quiet">
        Read from {p.source}
      </Text>
    </YStack>
  )
}

export function Audiences() {
  const http = useHttp()
  const audiences = useAudiences(http)
  const [open, setOpen] = useState('')
  const [name, setName] = useState('')
  const [event, setEvent] = useState('')
  const [days, setDays] = useState('30')
  const { busy, failed, run } = useRun()

  const save = () =>
    run(
      () => createAudience(http!, { name: name.trim(), event: event.trim(), windowDays: Number(days) || 0 }),
      () => {
        setName('')
        setEvent('')
        audiences.again()
      },
    )

  return (
    <Ready>
      <Screen title="Audiences" says="Who a sequence reaches, measured live against your customers.">
        <XStack gap="$2" flexWrap="wrap" items="center">
          <Field value={name} set={setName} hint="Audience name" />
          <Field value={event} set={setEvent} hint="Event (blank for everyone)" />
          <Field type="number" value={days} set={setDays} hint="Days" width={80} />
          <Text fontSize="$1" color="$quiet">
            days back
          </Text>
          <Act loud onPress={() => void save()} disabled={busy || !name.trim()}>
            Save audience
          </Act>
        </XStack>
        <Refusal says={failed} />

        <List read={audiences} what="the audiences" none="No audiences yet.">
          {(rows) =>
            rows.map((a) => (
              <YStack key={a.id}>
                <Row>
                  <YStack flex={1} minW={200} gap="$1">
                    <Text fontSize="$2" color="$ink" numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text fontSize="$1" color="$soft">
                      {a.event ? `Fired ${a.event} in the last ${a.windowDays} days` : 'Everyone in the organization'}
                    </Text>
                  </YStack>
                  <Text fontSize="$1" color="$quiet">
                    Saved {since(a.createdAt)}
                  </Text>
                  <Act on={open === a.id} onPress={() => setOpen(open === a.id ? '' : a.id)}>
                    Reach
                  </Act>
                  <Act onPress={() => void run(() => dropAudience(http!, a.id), audiences.again)} disabled={busy}>
                    Delete
                  </Act>
                </Row>
                {open === a.id ? <Reach id={a.id} /> : null}
              </YStack>
            ))
          }
        </List>
      </Screen>
    </Ready>
  )
}
