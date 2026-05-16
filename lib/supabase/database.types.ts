export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          clicked_at: string
          content_id: string
          content_type: string
          destination_url: string
          id: string
          product_slug: string | null
        }
        Insert: {
          clicked_at?: string
          content_id: string
          content_type: string
          destination_url: string
          id?: string
          product_slug?: string | null
        }
        Update: {
          clicked_at?: string
          content_id?: string
          content_type?: string
          destination_url?: string
          id?: string
          product_slug?: string | null
        }
        Relationships: []
      }
      affiliate_links: {
        Row: {
          created_at: string | null
          id: string
          network: string | null
          review_id: string
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          network?: string | null
          review_id: string
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          network?: string | null
          review_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          merch_id: string
          qty: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          merch_id: string
          qty?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          merch_id?: string
          qty?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_merch_id_fkey"
            columns: ["merch_id"]
            isOneToOne: false
            referencedRelation: "merch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "merch_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          anon_session_id: string | null
          created_at: string
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anon_session_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anon_session_id?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          blurb: string | null
          collection_id: string
          created_at: string
          id: string
          position: number
          review_id: string
          role_label: string | null
          wins_category: string | null
        }
        Insert: {
          blurb?: string | null
          collection_id: string
          created_at?: string
          id?: string
          position?: number
          review_id: string
          role_label?: string | null
          wins_category?: string | null
        }
        Update: {
          blurb?: string | null
          collection_id?: string
          created_at?: string
          id?: string
          position?: number
          review_id?: string
          role_label?: string | null
          wins_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_items_pick_list_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          bundle_total_cents: number | null
          collection_type: string
          created_at: string
          description: string | null
          hero_image_url: string | null
          id: string
          intro_html: string | null
          is_visible: boolean
          meta_description: string | null
          meta_title: string | null
          occasion: string | null
          published_at: string | null
          scheduled_publish_at: string | null
          slug: string
          title: string
          updated_at: string
          winner_summary: string | null
        }
        Insert: {
          bundle_total_cents?: number | null
          collection_type?: string
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          intro_html?: string | null
          is_visible?: boolean
          meta_description?: string | null
          meta_title?: string | null
          occasion?: string | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug: string
          title: string
          updated_at?: string
          winner_summary?: string | null
        }
        Update: {
          bundle_total_cents?: number | null
          collection_type?: string
          created_at?: string
          description?: string | null
          hero_image_url?: string | null
          id?: string
          intro_html?: string | null
          is_visible?: boolean
          meta_description?: string | null
          meta_title?: string | null
          occasion?: string | null
          published_at?: string | null
          scheduled_publish_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          winner_summary?: string | null
        }
        Relationships: []
      }
      comment_shares: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_shares_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          body: string
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          moderation_flags: Json
          moderation_score: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          body: string
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          moderation_flags?: Json
          moderation_score?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          moderation_flags?: Json
          moderation_score?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_revisions: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot: Json
          version_number: number
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_tags: {
        Row: {
          guide_id: string
          tag_slug: string
        }
        Insert: {
          guide_id: string
          tag_slug: string
        }
        Update: {
          guide_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_tags_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "guides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guide_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      guides: {
        Row: {
          author_id: string
          category: string
          content: string
          created_at: string | null
          excerpt: string | null
          faqs: Json
          has_affiliate_links: boolean
          id: string
          image_url: string | null
          is_visible: boolean
          key_takeaways: Json
          legacy_slugs: string[]
          meta_description: string | null
          meta_title: string | null
          moderation_flags: Json | null
          moderation_score: number | null
          published_at: string | null
          reading_time_minutes: number | null
          rejection_reason: string | null
          scheduled_publish_at: string | null
          scroll_100_count: number
          scroll_25_count: number
          scroll_50_count: number
          scroll_75_count: number
          search_vector: unknown
          slug: string
          status: string
          title: string
          tldr: string | null
          updated_at: string | null
          view_count: number
        }
        Insert: {
          author_id: string
          category: string
          content: string
          created_at?: string | null
          excerpt?: string | null
          faqs?: Json
          has_affiliate_links?: boolean
          id?: string
          image_url?: string | null
          is_visible?: boolean
          key_takeaways?: Json
          legacy_slugs?: string[]
          meta_description?: string | null
          meta_title?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          published_at?: string | null
          reading_time_minutes?: number | null
          rejection_reason?: string | null
          scheduled_publish_at?: string | null
          scroll_100_count?: number
          scroll_25_count?: number
          scroll_50_count?: number
          scroll_75_count?: number
          search_vector?: unknown
          slug: string
          status?: string
          title: string
          tldr?: string | null
          updated_at?: string | null
          view_count?: number
        }
        Update: {
          author_id?: string
          category?: string
          content?: string
          created_at?: string | null
          excerpt?: string | null
          faqs?: Json
          has_affiliate_links?: boolean
          id?: string
          image_url?: string | null
          is_visible?: boolean
          key_takeaways?: Json
          legacy_slugs?: string[]
          meta_description?: string | null
          meta_title?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          published_at?: string | null
          reading_time_minutes?: number | null
          rejection_reason?: string | null
          scheduled_publish_at?: string | null
          scroll_100_count?: number
          scroll_25_count?: number
          scroll_50_count?: number
          scroll_75_count?: number
          search_vector?: unknown
          slug?: string
          status?: string
          title?: string
          tldr?: string | null
          updated_at?: string | null
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "articles_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtag_presets: {
        Row: {
          created_at: string
          id: string
          name: string
          platform: string
          tags: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          platform?: string
          tags?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          platform?: string
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          content_id: string
          content_type: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt_text: string | null
          bucket: string
          category: string | null
          created_at: string
          file_size: number | null
          filename: string
          id: string
          is_primary: boolean
          label: string | null
          mime_type: string | null
          position: number | null
          product_id: string | null
          tags: string[]
          uploaded_by: string | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          bucket?: string
          category?: string | null
          created_at?: string
          file_size?: number | null
          filename: string
          id?: string
          is_primary?: boolean
          label?: string | null
          mime_type?: string | null
          position?: number | null
          product_id?: string | null
          tags?: string[]
          uploaded_by?: string | null
          url: string
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          category?: string | null
          created_at?: string
          file_size?: number | null
          filename?: string
          id?: string
          is_primary?: boolean
          label?: string | null
          mime_type?: string | null
          position?: number | null
          product_id?: string | null
          tags?: string[]
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merch: {
        Row: {
          archived_at: string | null
          category: string | null
          created_at: string
          currency: string
          default_image_url: string | null
          description: string | null
          enabled_images: string[]
          external_url: string | null
          featured: boolean
          id: string
          image_url: string | null
          images: string[]
          name: string
          position: number
          price_cents: number | null
          printful_sync_product_id: number | null
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          default_image_url?: string | null
          description?: string | null
          enabled_images?: string[]
          external_url?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          images?: string[]
          name: string
          position?: number
          price_cents?: number | null
          printful_sync_product_id?: number | null
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          category?: string | null
          created_at?: string
          currency?: string
          default_image_url?: string | null
          description?: string | null
          enabled_images?: string[]
          external_url?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          images?: string[]
          name?: string
          position?: number
          price_cents?: number | null
          printful_sync_product_id?: number | null
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      merch_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          in_stock: boolean
          merch_id: string
          position: number
          printful_sync_variant_id: number | null
          printful_variant_id: number | null
          retail_price_cents: number
          size: string | null
          updated_at: string
          weight_g: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          in_stock?: boolean
          merch_id: string
          position?: number
          printful_sync_variant_id?: number | null
          printful_variant_id?: number | null
          retail_price_cents: number
          size?: string | null
          updated_at?: string
          weight_g?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          in_stock?: boolean
          merch_id?: string
          position?: number
          printful_sync_variant_id?: number | null
          printful_variant_id?: number | null
          retail_price_cents?: number
          size?: string | null
          updated_at?: string
          weight_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "merch_variants_merch_id_fkey"
            columns: ["merch_id"]
            isOneToOne: false
            referencedRelation: "merch"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          reason: string | null
          target_id: string
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          target_id: string
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          reason?: string | null
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirmed: boolean | null
          created_at: string | null
          email: string
          id: string
          interests: string[]
        }
        Insert: {
          confirmed?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          interests?: string[]
        }
        Update: {
          confirmed?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          interests?: string[]
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_snapshot_url: string | null
          merch_id: string
          name_snapshot: string
          order_id: string
          qty: number
          unit_price_cents: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_snapshot_url?: string | null
          merch_id: string
          name_snapshot: string
          order_id: string
          qty: number
          unit_price_cents: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_snapshot_url?: string | null
          merch_id?: string
          name_snapshot?: string
          order_id?: string
          qty?: number
          unit_price_cents?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_merch_id_fkey"
            columns: ["merch_id"]
            isOneToOne: false
            referencedRelation: "merch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "merch_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          confirmation_email_attempts: number
          confirmation_email_error: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          currency: string
          email: string
          id: string
          order_number: string
          printful_order_id: number | null
          shipping_address: Json
          shipping_cents: number
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirmation_email_attempts?: number
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          currency?: string
          email: string
          id?: string
          order_number: string
          printful_order_id?: number | null
          shipping_address?: Json
          shipping_cents?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirmation_email_attempts?: number
          confirmation_email_error?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          currency?: string
          email?: string
          id?: string
          order_number?: string
          printful_order_id?: number | null
          shipping_address?: Json
          shipping_cents?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      press_outreach: {
        Row: {
          body: string
          brand_name: string
          contact_email: string | null
          contact_method: string
          contact_name: string | null
          contact_url: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          product_id: string | null
          product_name: string
          responded_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          body: string
          brand_name: string
          contact_email?: string | null
          contact_method?: string
          contact_name?: string | null
          contact_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string
          brand_name?: string
          contact_email?: string | null
          contact_method?: string
          contact_name?: string | null
          contact_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "press_outreach_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "press_outreach_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          affiliate_url: string | null
          asin: string | null
          category: string | null
          created_at: string
          custom_store_name: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          non_affiliate_url: string | null
          price_cents: number | null
          slug: string
          status: string
          store: string
          updated_at: string
        }
        Insert: {
          affiliate_url?: string | null
          asin?: string | null
          category?: string | null
          created_at?: string
          custom_store_name?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          non_affiliate_url?: string | null
          price_cents?: number | null
          slug: string
          status?: string
          store?: string
          updated_at?: string
        }
        Update: {
          affiliate_url?: string | null
          asin?: string | null
          category?: string | null
          created_at?: string
          custom_store_name?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          non_affiliate_url?: string | null
          price_cents?: number | null
          slug?: string
          status?: string
          store?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          deletion_requested_at: string | null
          display_name: string | null
          id: string
          moderation_action_at: string | null
          moderation_action_by: string | null
          moderation_note: string | null
          moderation_reason: string | null
          role: string
          suspended_until: string | null
          tagline: string | null
          trusted_commenter: boolean
          username: string
        }
        Insert: {
          account_status?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          deletion_requested_at?: string | null
          display_name?: string | null
          id: string
          moderation_action_at?: string | null
          moderation_action_by?: string | null
          moderation_note?: string | null
          moderation_reason?: string | null
          role?: string
          suspended_until?: string | null
          tagline?: string | null
          trusted_commenter?: boolean
          username: string
        }
        Update: {
          account_status?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          deletion_requested_at?: string | null
          display_name?: string | null
          id?: string
          moderation_action_at?: string | null
          moderation_action_by?: string | null
          moderation_note?: string | null
          moderation_reason?: string | null
          role?: string
          suspended_until?: string | null
          tagline?: string | null
          trusted_commenter?: boolean
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_moderation_action_by_fkey"
            columns: ["moderation_action_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_tags: {
        Row: {
          review_id: string
          tag_slug: string
        }
        Insert: {
          review_id: string
          tag_slug: string
        }
        Update: {
          review_id?: string
          tag_slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_tags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tags_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["slug"]
          },
        ]
      }
      reviews: {
        Row: {
          author_id: string
          best_for: Json
          category: string
          cons: Json | null
          content: string
          created_at: string | null
          disclosure_acknowledged: boolean | null
          excerpt: string | null
          faqs: Json
          featured: boolean
          has_affiliate_links: boolean | null
          how_you_used_it: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          key_takeaways: Json
          legacy_slugs: string[]
          meta_description: string | null
          meta_title: string | null
          moderation_flags: Json | null
          moderation_score: number | null
          not_for: Json
          price_paid_cents: number | null
          product_name: string
          product_slug: string | null
          pros: Json | null
          published_at: string | null
          rating: number | null
          reading_time_minutes: number | null
          rejection_reason: string | null
          scheduled_publish_at: string | null
          score_daily_use: number | null
          score_ease: number | null
          score_quality: number | null
          score_value: number | null
          scroll_100_count: number
          scroll_25_count: number
          scroll_50_count: number
          scroll_75_count: number
          search_vector: unknown
          slug: string
          standout_moment: string | null
          status: string
          testing_duration: string | null
          title: string
          tldr: string | null
          updated_at: string | null
          view_count: number
          would_rebuy: boolean | null
        }
        Insert: {
          author_id: string
          best_for?: Json
          category: string
          cons?: Json | null
          content: string
          created_at?: string | null
          disclosure_acknowledged?: boolean | null
          excerpt?: string | null
          faqs?: Json
          featured?: boolean
          has_affiliate_links?: boolean | null
          how_you_used_it?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          key_takeaways?: Json
          legacy_slugs?: string[]
          meta_description?: string | null
          meta_title?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          not_for?: Json
          price_paid_cents?: number | null
          product_name: string
          product_slug?: string | null
          pros?: Json | null
          published_at?: string | null
          rating?: number | null
          reading_time_minutes?: number | null
          rejection_reason?: string | null
          scheduled_publish_at?: string | null
          score_daily_use?: number | null
          score_ease?: number | null
          score_quality?: number | null
          score_value?: number | null
          scroll_100_count?: number
          scroll_25_count?: number
          scroll_50_count?: number
          scroll_75_count?: number
          search_vector?: unknown
          slug: string
          standout_moment?: string | null
          status?: string
          testing_duration?: string | null
          title: string
          tldr?: string | null
          updated_at?: string | null
          view_count?: number
          would_rebuy?: boolean | null
        }
        Update: {
          author_id?: string
          best_for?: Json
          category?: string
          cons?: Json | null
          content?: string
          created_at?: string | null
          disclosure_acknowledged?: boolean | null
          excerpt?: string | null
          faqs?: Json
          featured?: boolean
          has_affiliate_links?: boolean | null
          how_you_used_it?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          key_takeaways?: Json
          legacy_slugs?: string[]
          meta_description?: string | null
          meta_title?: string | null
          moderation_flags?: Json | null
          moderation_score?: number | null
          not_for?: Json
          price_paid_cents?: number | null
          product_name?: string
          product_slug?: string | null
          pros?: Json | null
          published_at?: string | null
          rating?: number | null
          reading_time_minutes?: number | null
          rejection_reason?: string | null
          scheduled_publish_at?: string | null
          score_daily_use?: number | null
          score_ease?: number | null
          score_quality?: number | null
          score_value?: number | null
          scroll_100_count?: number
          scroll_25_count?: number
          scroll_50_count?: number
          scroll_75_count?: number
          search_vector?: unknown
          slug?: string
          standout_moment?: string | null
          status?: string
          testing_duration?: string | null
          title?: string
          tldr?: string | null
          updated_at?: string | null
          view_count?: number
          would_rebuy?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          link_url: string | null
          notes: string | null
          platform: string
          posted_at: string | null
          source_id: string | null
          source_title: string | null
          source_type: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          notes?: string | null
          platform?: string
          posted_at?: string | null
          source_id?: string | null
          source_title?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          notes?: string | null
          platform?: string
          posted_at?: string | null
          source_id?: string | null
          source_title?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string | null
          display_order: number
          label: string
          slug: string
          tag_group: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          label: string
          slug: string
          tag_group: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          label?: string
          slug?: string
          tag_group?: string
        }
        Relationships: []
      }
      user_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_ratings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_profiles: {
        Row: {
          daughter_dob: string | null
          facts: Json
          faith_values: string | null
          id: string
          occupation: string | null
          region: string | null
          self_dob: string | null
          updated_at: string
          user_id: string
          wife_dob: string | null
        }
        Insert: {
          daughter_dob?: string | null
          facts?: Json
          faith_values?: string | null
          id?: string
          occupation?: string | null
          region?: string | null
          self_dob?: string | null
          updated_at?: string
          user_id: string
          wife_dob?: string | null
        }
        Update: {
          daughter_dob?: string | null
          facts?: Json
          faith_values?: string | null
          id?: string
          occupation?: string | null
          region?: string | null
          self_dob?: string | null
          updated_at?: string
          user_id?: string
          wife_dob?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_items: {
        Row: {
          affiliate_url: string | null
          asin: string | null
          created_at: string
          custom_store_name: string | null
          description: string | null
          estimated_review_date: string | null
          id: string
          image_url: string | null
          priority: number
          review_id: string | null
          skip_reason: string | null
          slug: string
          status: string
          store: string | null
          title: string
          updated_at: string
        }
        Insert: {
          affiliate_url?: string | null
          asin?: string | null
          created_at?: string
          custom_store_name?: string | null
          description?: string | null
          estimated_review_date?: string | null
          id?: string
          image_url?: string | null
          priority?: number
          review_id?: string | null
          skip_reason?: string | null
          slug: string
          status?: string
          store?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          affiliate_url?: string | null
          asin?: string | null
          created_at?: string
          custom_store_name?: string | null
          description?: string | null
          estimated_review_date?: string | null
          id?: string
          image_url?: string | null
          priority?: number
          review_id?: string | null
          skip_reason?: string | null
          slug?: string
          status?: string
          store?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_subscriptions: {
        Row: {
          created_at: string
          id: string
          notified: boolean
          notified_at: string | null
          user_id: string
          wishlist_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          user_id: string
          wishlist_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notified?: boolean
          notified_at?: string | null
          user_id?: string
          wishlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_subscriptions_wishlist_item_id_fkey"
            columns: ["wishlist_item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_votes: {
        Row: {
          created_at: string
          id: string
          user_id: string
          wishlist_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          wishlist_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          wishlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_votes_wishlist_item_id_fkey"
            columns: ["wishlist_item_id"]
            isOneToOne: false
            referencedRelation: "wishlist_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_review_rating_summary: {
        Args: { p_review_id: string }
        Returns: {
          avg_rating: number
          rating_count: number
          user_rating: number
        }[]
      }
      get_wishlist_item_status: {
        Args: { p_item_id: string }
        Returns: {
          user_has_voted: boolean
          user_subscribed: boolean
          vote_count: number
        }[]
      }
      increment_guide_views: { Args: { row_id: string }; Returns: undefined }
      increment_review_views: { Args: { row_id: string }; Returns: undefined }
      increment_scroll_depth: {
        Args: {
          p_content_id: string
          p_content_type: string
          p_milestone: number
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_author_or_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
