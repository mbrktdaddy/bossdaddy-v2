'use client'

import { useState } from 'react'
import SocialPostCard, { type Post } from './SocialPostCard'
import HashtagPresetsPanel, { type HashtagPreset } from './HashtagPresetsPanel'
import type { SourceLinks } from './LinkPicker'

interface Props {
  posts: Post[]
  charLimit: number | null
  sourceLinks: SourceLinks
  initialPresets: HashtagPreset[]
  platform: string
}

export default function SocialPostList({ posts: initial, charLimit, sourceLinks, initialPresets, platform }: Props) {
  const [posts, setPosts]     = useState(initial)
  const [presets, setPresets] = useState(initialPresets)

  function onUpdate(updated: Post) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function onDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Hashtag presets manager */}
      <HashtagPresetsPanel
        presets={presets}
        platform={platform}
        onPresetsChange={setPresets}
      />

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-sm">No posts yet. Hit Generate to create your first one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <SocialPostCard
              key={post.id}
              post={post}
              charLimit={charLimit}
              sourceLinks={sourceLinks}
              presets={presets}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
