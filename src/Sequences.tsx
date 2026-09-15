// Every drip sequence, and a new one by name.

import { useState } from 'react'
import { Text, XStack } from '@hanzo/ui'
import { Link, useNavigate } from 'react-router'

import { Act, Field, List, Ready, Refusal, Row, Screen, useRun } from '~/page'
import { Mark, tone } from '~/status'
import { since } from '~/time'
import { useHttp } from '~/client'
import { createSequence, useSequences } from '~/marketing'

export function Sequences() {
  const http = useHttp()
  const go = useNavigate()
  const sequences = useSequences(http)
  const [name, setName] = useState('')
  const { busy, failed, run } = useRun()

  const make = () =>
    run(async () => {
      const made = await createSequence(http!, name.trim())
      go(`/sequences/${made.id}`)
    })

  return (
    <Ready>
      <Screen
        title="Sequences"
        says="Emails sent one after another, each on its own delay, to everyone enrolled."
        beside={
          <XStack gap="$2" minW={320}>
            <Field value={name} set={setName} hint="Name a new sequence" />
            <Act loud onPress={() => void make()} disabled={busy || !name.trim()}>
              Create
            </Act>
          </XStack>
        }
      >
        <Refusal says={failed} />
        <List read={sequences} what="the sequences" none="No sequences yet. Name one to start.">
          {(rows) =>
            rows.map((q) => (
              <Link key={q.id} to={`/sequences/${q.id}`} style={{ textDecoration: 'none' }}>
                <Row>
                  <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
                    {q.name}
                  </Text>
                  <Mark of={tone(q.status)} says={q.status} />
                  <Text fontSize="$1" color="$quiet">
                    Updated {since(q.updatedAt)}
                  </Text>
                </Row>
              </Link>
            ))
          }
        </List>
      </Screen>
    </Ready>
  )
}
