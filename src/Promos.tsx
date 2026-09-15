// Launch offers, their live counters, and this organization's claim. A claim is
// recorded, not credited: no money moves here.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { Act, Choice, Count, Field, List, Ready, Refusal, Screen, useRun } from '~/page'
import { Mark } from '~/status'
import { at } from '~/time'
import { useHttp } from '~/client'
import { quote, redeem, usd, usePromos, useRedemption, type PromoStatus, type Quote, type Redeemed } from '~/marketing'

function Offer({ s }: { s: PromoStatus }) {
  const http = useHttp()
  const p = s.promo
  const plans = p.plans.split(',').map((v) => v.trim()).filter(Boolean)
  const mine = useRedemption(http, p.code)
  const [plan, setPlan] = useState(plans[0] ?? '')
  const [seats, setSeats] = useState('1')
  const [priced, setPriced] = useState<Quote | null>(null)
  const [instrument, setInstrument] = useState('')
  const [claimed, setClaimed] = useState<Redeemed | null>(null)
  const { busy, failed, run } = useRun()
  const r = mine.it

  return (
    <YStack gap="$3" p="$4" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$3">
        <Text fontSize="$3" fontWeight="500" color="$ink" flex={1}>
          {p.code}
        </Text>
        <Mark of={p.active ? 'up' : 'quiet'} says={p.active ? 'offered' : 'not offered'} />
      </XStack>
      <Text fontSize="$2" color="$soft">
        {p.description}
      </Text>
      <XStack gap="$3" flexWrap="wrap">
        <Count of={`${p.percentOff}%`} says="Off the first month" />
        <Count of={s.redeemed} says="Organizations redeemed" />
        <Count of={s.remaining} says={`Left of ${p.maxRedemptions}`} />
      </XStack>
      <Text fontSize="$1" color="$quiet">
        Plans: {plans.join(', ') || 'none'}
        {p.teamSeatCap ? ` · up to ${p.teamSeatCap} team seats at the offer price` : ''}
      </Text>

      <Text fontSize="$2" color="$soft">
        {r
          ? `Redeemed ${at(r.redeemedAt)} on ${r.plan}, claiming ${usd(r.discountCents)} off.`
          : r === false
            ? 'Not redeemed by this organization.'
            : mine.failed ?? ''}
      </Text>

      <XStack gap="$2" items="center" flexWrap="wrap">
        <Choice value={plan} set={setPlan} of={plans} hint="Plan" />
        <Field type="number" value={seats} set={setSeats} hint="Seats" width={80} />
        <Act onPress={() => void run(async () => setPriced(await quote(http!, p.code, plan, Number(seats) || 1)))} disabled={busy || !plan}>
          Price it
        </Act>
      </XStack>
      {priced ? (
        <Text fontSize="$1" color="$soft">
          {priced.eligible
            ? `First month ${usd(priced.chargeCents)} after ${usd(priced.discountCents)} off; list ${usd(priced.listCents)}.`
            : `Not available: ${priced.reason}`}
        </Text>
      ) : null}

      <XStack gap="$2" items="center">
        <Field value={instrument} set={setInstrument} hint="Payment method" />
        <Act
          onPress={() => void run(async () => setClaimed(await redeem(http!, p.code, instrument.trim())), mine.again)}
          disabled={busy || !instrument.trim()}
        >
          Redeem
        </Act>
      </XStack>
      {claimed ? (
        <Text fontSize="$1" color="$soft">
          {claimed.alreadyRedeemed ? 'Already redeemed.' : 'Redeemed.'} First month {usd(claimed.chargeCents)},{' '}
          {usd(claimed.discountCents)} off.
        </Text>
      ) : null}
      <Refusal says={failed} />
    </YStack>
  )
}

export function Promos() {
  const promos = usePromos(useHttp())
  return (
    <Ready>
      <Screen title="Promos" says="Offers on this deployment, how many are left, and what one would cost you.">
        <List read={promos} what="the promos" none="No promos are offered right now.">
          {(rows) => (
            <YStack gap="$3">
              {rows.map((s) => (
                <Offer key={s.promo.code} s={s} />
              ))}
            </YStack>
          )}
        </List>
      </Screen>
    </Ready>
  )
}
