// Campaign totals and the sequences this organization sends.

import { Text, XStack, YStack } from '@hanzo/ui'
import { Link } from 'react-router'

import { Count, Failed, Heading, List, Ready, Row, Screen } from '~/page'
import { Mark, tone } from '~/status'
import { since } from '~/time'
import { useHttp } from '~/client'
import { usd, useSequences, useSummary } from '~/marketing'

export function Overview() {
  const http = useHttp()
  const summary = useSummary(http)
  const sequences = useSequences(http)
  const s = summary.it

  return (
    <Ready>
      <Screen title="Overview" says="What this organization runs, and what it has set aside for it.">
        {summary.failed ? (
          <Failed what="the totals" why={summary.failed} />
        ) : (
          <XStack gap="$3" flexWrap="wrap">
            <Count of={s?.campaigns} says="Campaigns" />
            <Count of={s?.active} says="Active campaigns" />
            <Count of={s && usd(s.budget)} says="Budget" />
            {/* Spend is summed from what campaigns report, not measured. */}
            <Count of={s && usd(s.spend)} says="Reported spend" />
          </XStack>
        )}

        <YStack gap="$2">
          <XStack items="baseline" gap="$3">
            <YStack flex={1}>
              <Heading>Sequences</Heading>
            </YStack>
            <Link to="/sequences" style={{ textDecoration: 'none' }}>
              <Text fontSize="$1" color="$soft">
                All sequences
              </Text>
            </Link>
          </XStack>
          <List read={sequences} what="the sequences" none="No sequences yet.">
            {(rows) =>
              rows.slice(0, 8).map((q) => (
                <Link key={q.id} to={`/sequences/${q.id}`} style={{ textDecoration: 'none' }}>
                  <Row>
                    <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
                      {q.name}
                    </Text>
                    <Mark of={tone(q.status)} says={q.status} />
                    <Text fontSize="$1" color="$quiet">
                      {since(q.updatedAt)}
                    </Text>
                  </Row>
                </Link>
              ))
            }
          </List>
        </YStack>
      </Screen>
    </Ready>
  )
}
