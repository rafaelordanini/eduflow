-- Only the authenticated server endpoint calls this function. EduFlow uses
-- integer application users and its own JWT, not Supabase Auth UUIDs.
create or replace function public.recreate_macro_plan(
  p_user_id integer,
  p_plan jsonb,
  p_data_prova date,
  p_reset_progress boolean,
  p_start_date date
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_plan_id integer;
begin
  if p_plan is null or jsonb_typeof(p_plan) <> 'object'
     or p_start_date is null or p_reset_progress is null
     or (p_plan->>'modoRecriacao') is distinct from
        (case when p_reset_progress then 'do_zero' else 'continuar' end) then
    raise exception 'Modo de recriação ou plano inválido.';
  end if;

  -- Serialize replacements for this user. All writes roll back together.
  perform id from public.users where id = p_user_id for update;
  if not found then raise exception 'Usuário não encontrado.'; end if;

  insert into public.macro_plans(user_id, plan_json, data_prova)
    values (p_user_id, p_plan, p_data_prova)
    returning id into new_plan_id;

  if p_reset_progress then
    update public.progress
      set completed = false, current_time_seconds = 0
      where user_id = p_user_id;
  end if;

  delete from public.macro_plans where user_id = p_user_id and id <> new_plan_id;
  delete from public.daily_plans where user_id = p_user_id and plan_date >= p_start_date;
  return new_plan_id;
end;
$$;

revoke all on function public.recreate_macro_plan(integer, jsonb, date, boolean, date)
  from public, anon, authenticated;
grant execute on function public.recreate_macro_plan(integer, jsonb, date, boolean, date)
  to service_role;
