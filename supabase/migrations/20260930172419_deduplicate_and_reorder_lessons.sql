-- Keep imported aliases and their historical data for recovery, but expose one
-- active lesson per video. Mutable order_index must never be an identity key.
alter table public.lessons add column duplicate_of_id integer
  references public.lessons(id) on delete cascade;
alter table public.lessons add constraint lessons_duplicate_not_self
  check (duplicate_of_id is null or duplicate_of_id <> id);

create function public.lesson_drive_file_id(p_url text, p_embed text)
returns text language sql immutable security invoker set search_path = '' as $$
  select coalesce(
    substring(btrim(p_url) from '/file/d/([a-zA-Z0-9_-]+)'),
    substring(btrim(p_url) from '[?&]id=([a-zA-Z0-9_-]+)'),
    substring(btrim(p_url) from '^([a-zA-Z0-9_-]{15,})$'),
    substring(btrim(p_embed) from '/file/d/([a-zA-Z0-9_-]+)'),
    substring(btrim(p_embed) from '[?&]id=([a-zA-Z0-9_-]+)'),
    substring(btrim(p_embed) from '^([a-zA-Z0-9_-]{15,})$')
  );
$$;

-- Confirmed against the actual video names in Drive: these are distinct
-- classes with an incorrect copied link, not duplicate lessons.
update public.lessons l
set drive_url = 'https://drive.google.com/file/d/1pZabhjmE245HQGbem10P7KQhp27ENWrd/view',
    embed_url = 'https://drive.google.com/file/d/1pZabhjmE245HQGbem10P7KQhp27ENWrd/preview'
from public.subjects s
where l.subject_id = s.id and s.name = 'Português' and l.title like 'M1A2%'
  and public.lesson_drive_file_id(l.drive_url, l.embed_url) = '1euER-KBrusAlmQfe57YbvQwttzjwUKur';
update public.lessons l
set drive_url = 'https://drive.google.com/file/d/1YjRz_y0zhgXr1oUM4llQKMqfU2VrPtmw/view',
    embed_url = 'https://drive.google.com/file/d/1YjRz_y0zhgXr1oUM4llQKMqfU2VrPtmw/preview'
from public.subjects s
where l.subject_id = s.id and s.name = 'História do Brasil' and l.title like 'M4A7%'
  and public.lesson_drive_file_id(l.drive_url, l.embed_url) = '1QkBvl7HTqzMyLMtj3rvGRnGbpoFTyuX1';

create temporary table lesson_aliases on commit drop as
with ranked as (
  select id, first_value(id) over (
    partition by subject_id, public.lesson_drive_file_id(drive_url, embed_url)
    order by (title ~* '^M[0-9]+A[0-9]+') desc,
             (coalesce(duration_minutes, 0) > 0) desc, id
  ) as canonical_id
  from public.lessons
  where duplicate_of_id is null and public.lesson_drive_file_id(drive_url, embed_url) is not null
)
select id, canonical_id from ranked where id <> canonical_id;

-- Transfer every user's completion and furthest playback position. Original
-- alias records remain intact as a historical backup.
insert into public.progress (user_id, lesson_id, completed, current_time_seconds, last_accessed)
select p.user_id, a.canonical_id, bool_or(coalesce(p.completed, false)),
       max(coalesce(p.current_time_seconds, 0)), max(p.last_accessed)
from public.progress p join pg_temp.lesson_aliases a on a.id = p.lesson_id
group by p.user_id, a.canonical_id
on conflict (user_id, lesson_id) do update
set completed = coalesce(progress.completed, false) or excluded.completed,
    current_time_seconds = greatest(progress.current_time_seconds, excluded.current_time_seconds),
    last_accessed = greatest(progress.last_accessed, excluded.last_accessed);

-- Preserve cached questions and their bank IDs (attempts are untouched).
insert into public.lesson_questions (lesson_id, questoes)
select canonical_id, jsonb_agg(question order by question::text)
from (
  select distinct coalesce(a.canonical_id, q.lesson_id) as canonical_id, question
  from public.lesson_questions q
  left join pg_temp.lesson_aliases a on a.id = q.lesson_id
  cross join lateral jsonb_array_elements(q.questoes) question
  where a.id is not null or q.lesson_id in (select canonical_id from pg_temp.lesson_aliases)
) merged group by canonical_id
on conflict (lesson_id) do update set questoes = excluded.questoes;

update public.lessons l set duplicate_of_id = a.canonical_id
from pg_temp.lesson_aliases a where l.id = a.id;

create unique index lessons_active_subject_drive_unique
on public.lessons (subject_id, public.lesson_drive_file_id(drive_url, embed_url))
where duplicate_of_id is null and public.lesson_drive_file_id(drive_url, embed_url) is not null;
create index lessons_duplicate_of_idx on public.lessons (duplicate_of_id)
where duplicate_of_id is not null;

-- Atomic move: lock the subject so concurrent moves cannot produce tied or
-- missing positions. No progress, question, or plan record is reset.
create function public.reorder_lesson(p_lesson_id integer, p_direction integer default null,
                                      p_position integer default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_subject integer;
  v_ids integer[];
  v_index integer;
  v_target integer;
  v_count integer;
begin
  select subject_id into v_subject from public.lessons
  where id = p_lesson_id and duplicate_of_id is null;
  if not found then raise exception 'Aula não encontrada.' using errcode = 'P0002'; end if;
  perform 1 from public.subjects where id = v_subject for update;
  select array_agg(id order by order_index, id) into v_ids from public.lessons
  where subject_id = v_subject and duplicate_of_id is null;
  v_count := coalesce(array_length(v_ids, 1), 0);
  v_index := array_position(v_ids, p_lesson_id);
  if v_index is null then raise exception 'Aula não encontrada.' using errcode = 'P0002'; end if;
  if (p_direction is null) = (p_position is null) or
     (p_direction is not null and p_direction not in (-1, 1)) then
    raise exception 'Informe uma direção ou uma posição.' using errcode = '22023';
  end if;
  v_target := coalesce(p_position, v_index + p_direction);
  if v_target < 1 or v_target > v_count then
    raise exception 'Posição fora do intervalo de aulas.' using errcode = '22023';
  end if;
  v_ids := array_remove(v_ids, p_lesson_id);
  v_ids := coalesce(v_ids[1:v_target-1], '{}'::integer[]) || array[p_lesson_id] ||
           coalesce(v_ids[v_target:v_count], '{}'::integer[]);
  update public.lessons l set order_index = moved.position::integer
  from unnest(v_ids) with ordinality as moved(id, position) where l.id = moved.id;
  return jsonb_build_object('success', true, 'lessonId', p_lesson_id, 'position', v_target);
end;
$$;
revoke all on function public.reorder_lesson(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.reorder_lesson(integer, integer, integer) to service_role;
