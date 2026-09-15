// Addresses that asked not to hear from you. Every send checks this list.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { Act, Choice, Field, List, Ready, Refusal, Row, Screen, useRun } from '~/page'
import { since } from '~/time'
import { useHttp } from '~/client'
import { CHANNELS, suppress, unsuppress, useSuppressions } from '~/marketing'

export function Suppressions() {
  const http = useHttp()
  const list = useSuppressions(http)
  const [address, setAddress] = useState('')
  const [channel, setChannel] = useState<string>('email')
  const [reason, setReason] = useState('')
  const { busy, failed, run } = useRun()

  const add = () =>
    run(
      () => suppress(http!, { address: address.trim(), channel, reason: reason.trim() }),
      () => {
        setAddress('')
        setReason('')
        list.again()
      },
    )

  return (
    <Ready>
      <Screen title="Opt-outs" says="Nothing is sent to these addresses on these channels.">
        <XStack gap="$2" flexWrap="wrap" items="center">
          <Field value={address} set={setAddress} hint="person@example.com" />
          <Choice value={channel} set={setChannel} of={CHANNELS} hint="Channel" />
          <Field value={reason} set={setReason} hint="Reason" />
          <Act loud onPress={() => void add()} disabled={busy || !address.trim()}>
            Opt out
          </Act>
        </XStack>
        <Refusal says={failed} />

        <List read={list} what="the opt-outs" none="Nobody has opted out.">
          {(rows) =>
            rows.map((s) => (
              <Row key={`${s.channel}:${s.address}`}>
                <YStack flex={1} minW={200} gap="$1">
                  <Text fontSize="$2" color="$ink" numberOfLines={1}>
                    {s.address}
                  </Text>
                  <Text fontSize="$1" color="$soft">
                    {s.channel}
                    {s.reason ? ` · ${s.reason}` : ''}
                  </Text>
                </YStack>
                <Text fontSize="$1" color="$quiet">
                  {since(s.createdAt)}
                </Text>
                <Act onPress={() => void run(() => unsuppress(http!, s), list.again)} disabled={busy}>
                  Opt back in
                </Act>
              </Row>
            ))
          }
        </List>
      </Screen>
    </Ready>
  )
}
