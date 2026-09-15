// Posts on the content calendar. A failed publish keeps the platform's exact
// reason, and the screen shows it.

import { useState } from 'react'
import { Text, XStack, YStack } from '@hanzo/ui'

import { Act, Choice, Field, List, Ready, Refusal, Screen, Words, useRun } from '~/page'
import { Mark, tone } from '~/status'
import { at, fromField } from '~/time'
import { useHttp } from '~/client'
import { NETWORKS, POST_STATES, createPost, dropPost, publishPost, usePosts, type Post } from '~/marketing'

function One({ p, again }: { p: Post; again: () => void }) {
  const http = useHttp()
  const { busy, failed, run } = useRun()
  const when = p.publishedAt ? `published ${at(p.publishedAt)}` : p.scheduledAt ? `for ${at(p.scheduledAt)}` : 'unscheduled'

  return (
    <YStack gap="$2" py="$3" borderBottomWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$3">
        <Text fontSize="$2" color="$ink" flex={1} numberOfLines={1}>
          {p.title || p.body}
        </Text>
        <Mark of={tone(p.status)} says={p.status} />
      </XStack>
      <Text fontSize="$1" color="$soft">
        {p.channel} · {when}
      </Text>
      {p.title ? (
        <Text fontSize="$2" color="$soft" numberOfLines={2}>
          {p.body}
        </Text>
      ) : null}
      {p.error ? (
        <Text fontSize="$1" color="$ink" fontWeight="500">
          {p.error}
        </Text>
      ) : null}
      <XStack gap="$2">
        <Act onPress={() => void run(() => publishPost(http!, p.id), again)} disabled={busy}>
          Publish now
        </Act>
        <Act onPress={() => void run(() => dropPost(http!, p.id), again)} disabled={busy}>
          Delete
        </Act>
      </XStack>
      <Refusal says={failed} />
    </YStack>
  )
}

export function Calendar() {
  const http = useHttp()
  const [status, setStatus] = useState('')
  const posts = usePosts(http, status)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<string>('x')
  const [when, setWhen] = useState('')
  const { busy, failed, run } = useRun()

  const add = () =>
    run(
      () => createPost(http!, { title: title.trim(), body, channel, scheduledAt: fromField(when) }),
      () => {
        setTitle('')
        setBody('')
        setWhen('')
        posts.again()
      },
    )

  return (
    <Ready>
      <Screen title="Calendar" says="Posts planned for each network, latest first.">
        <YStack gap="$2">
          <XStack gap="$2" flexWrap="wrap" items="center">
            <Field value={title} set={setTitle} hint="Title" />
            <Choice value={channel} set={setChannel} of={NETWORKS} hint="Network" />
            <Field type="datetime-local" value={when} set={setWhen} hint="Publish at" width={200} />
          </XStack>
          <Words value={body} set={setBody} hint="Post text" />
          <XStack>
            <Act loud onPress={() => void add()} disabled={busy || !body.trim()}>
              {when ? 'Schedule post' : 'Save draft'}
            </Act>
          </XStack>
          <Refusal says={failed} />
        </YStack>

        <XStack gap="$2" flexWrap="wrap">
          {['', ...POST_STATES].map((s) => (
            <Act key={s || 'all'} on={status === s} onPress={() => setStatus(s)}>
              {s || 'all'}
            </Act>
          ))}
        </XStack>

        <List read={posts} what="the calendar" none={status ? `No ${status} posts.` : 'Nothing on the calendar yet.'}>
          {(rows) => rows.map((p) => <One key={`${p.id}:${p.updatedAt}`} p={p} again={posts.again} />)}
        </List>
      </Screen>
    </Ready>
  )
}
