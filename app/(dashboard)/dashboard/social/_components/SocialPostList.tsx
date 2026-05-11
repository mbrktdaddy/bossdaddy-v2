'use client'

import { useState } from 'react'
import SocialPostCard from './SocialPostCard'

interface Post {
  id: string
  platform: string
  content: string
  status: string
  source_type: string | null
  source_title: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Props {
  posts: Post[]
  charLimit: number | null
}

export default function SocialPostList({ posts: initial, charLimit }: Props) {
  const [posts, setPosts] = useState(initial)

  function onUpdate(updated: Post) {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  function onDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <p className="text-sm">No posts yet. Hit Generate to create your first one.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <SocialPostCard
          key={post.id}
          post={post}
          charLimit={charLimit}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
