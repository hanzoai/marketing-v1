// Campaigns: a channel, a lifecycle, a budget and a send time. Spend is what
// the campaign reports; nothing here measures it.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { Act, Choice, Field, List, Ready, Refusal, Screen, useRun } from '~/page'
import { Mark, tone } from '~/status'
import { at, fromField, toField } from '~/time'
import { useHttp } from '~/client'
import {
  CAMPAIGN_STATES,
  CHANNELS,
  createCampaign,
  dropCampaign,
  scheduleCampaign,
  updateCampaign,
  usd,
  useCampaigns,
  type Campaign,
} from '~/marketing'

function One({ c, again }: { c: Campaign; again: () => void }) {
  const http = useHttp()
  const [when, setWhen] = useState(toField(c.scheduledAt))
  const { busy, failed, run } = useRun()
  const facts = [
    c.channel,
    c.objective,
    `budget ${usd(c.budget)}`,
    `reported spend ${usd(c.spend)}`,
    c.scheduledAt ? `sends ${at(c.scheduledAt)}` : '',
  ]

  return (
    <YStack gap="$2" py="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$3">
        <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
          {c.name}
        </Text>
        <Mark of={tone(c.status)} says={c.status} />
      </XStack>
      <Text fontSize="$1" color="$soft">
        {facts.filter(Boolean).join(' · ')}
      </Text>
      <XStack gap="$2" items="center" flexWrap="wrap">
        <Choice
          value={c.status}
          set={(status) => void run(() => updateCampaign(http!, { ...c, status }), again)}
          of={CAMPAIGN_STATES}
          hint="Status"
        />
        <Field type="datetime-local" value={when} set={setWhen} hint="Send time" width={200} />
        <Act onPress={() => void run(() => scheduleCampaign(http!, c.id, fromField(when)), again)} disabled={busy}>
          {when ? 'Schedule' : 'Clear send time'}
        </Act>
        <Act onPress={() => void run(() => dropCampaign(http!, c.id), again)} disabled={busy}>
          Delete
        </Act>
      </XStack>
      <Refusal says={failed} />
    </YStack>
  )
}

export function Campaigns() {
  const http = useHttp()
  const [status, setStatus] = useState('')
  const campaigns = useCampaigns(http, status)
  const [name, setName] = useState('')
  const [channel, setChannel] = useState<string>('email')
  const [objective, setObjective] = useState('')
  const [budget, setBudget] = useState('')
  const { busy, failed, run } = useRun()

  const add = () =>
    run(
      () =>
        createCampaign(http!, {
          name: name.trim(),
          channel,
          objective: objective.trim(),
          budget: Math.round((Number(budget) || 0) * 100),
        }),
      () => {
        setName('')
        setObjective('')
        setBudget('')
        campaigns.again()
      },
    )

  return (
    <Ready>
      <Screen title="Campaigns" says="Each campaign's channel, stage, budget and send time.">
        <XStack gap="$2" flexWrap="wrap" items="center">
          <Field value={name} set={setName} hint="Campaign name" />
          <Choice value={channel} set={setChannel} of={CHANNELS} hint="Channel" />
          <Field value={objective} set={setObjective} hint="Objective" />
          <Field type="number" value={budget} set={setBudget} hint="Budget, USD" width={120} />
          <Act loud onPress={() => void add()} disabled={busy || !name.trim()}>
            Add campaign
          </Act>
        </XStack>
        <Refusal says={failed} />

        <XStack gap="$2" flexWrap="wrap">
          {['', ...CAMPAIGN_STATES].map((s) => (
            <Act key={s || 'all'} on={status === s} onPress={() => setStatus(s)}>
              {s || 'all'}
            </Act>
          ))}
        </XStack>

        <List read={campaigns} what="the campaigns" none={status ? `No ${status} campaigns.` : 'No campaigns yet.'}>
          {(rows) => rows.map((c) => <One key={`${c.id}:${c.updatedAt}`} c={c} again={campaigns.again} />)}
        </List>
      </Screen>
    </Ready>
  )
}
