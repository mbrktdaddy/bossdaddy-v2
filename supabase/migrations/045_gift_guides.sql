-- Add gift guide categorization to pick_lists.
-- pick_type splits "Boss Daddy Picks" (general curation) from "Gift Guides" (occasion-driven).
-- occasion lets gift guides target specific holidays/events for SEO compound (stable URLs).

alter table pick_lists
  add column if not exists pick_type text not null default 'general'
    check (pick_type in ('general', 'gift_guide', 'best_of'));

alter table pick_lists
  add column if not exists occasion text
    check (occasion is null or occasion in (
      -- Major holidays
      'fathers_day', 'mothers_day', 'christmas', 'valentines_day',
      'new_year', 'easter', 'thanksgiving', 'fourth_of_july',
      'halloween', 'memorial_day',
      -- Life milestones
      'birthday', 'graduation', 'wedding', 'anniversary',
      'baby_shower', 'new_dad', 'housewarming', 'retirement',
      -- Brand-themed seasons
      'grilling_season', 'camping_season', 'workshop',
      'back_to_school', 'summer_kickoff', 'super_bowl',
      -- Budget tiers
      'under_25', 'under_50', 'under_100', 'splurge'
    ));

create index if not exists idx_pick_lists_type     on pick_lists (pick_type);
create index if not exists idx_pick_lists_occasion on pick_lists (occasion) where occasion is not null;
