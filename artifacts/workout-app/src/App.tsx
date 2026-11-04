import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { setAuthTokenGetter, setBaseUrl, useAddCompletion, useAddWater, useDeleteCompletion, useGetAnalytics, useGetCompletions, useGetCurrentAccount, useGetMeals, useGetOverview, useGetProfile, useGetWater, useGetWeekPlan, useGetWeights, useGetWorkouts, useHealthCheck, useLoginAccount, useLogoutAccount, useRegisterAccount, useSaveProfile, useSaveWeight, getGetAnalyticsQueryKey, getGetCompletionsQueryKey, getGetCurrentAccountQueryKey, getGetMealsQueryKey, getGetOverviewQueryKey, getGetProfileQueryKey, getGetWaterQueryKey, getGetWeekPlanQueryKey, getGetWeightsQueryKey, getGetWorkoutsQueryKey } from '@workspace/api-client-react';
import type { Meal, Profile, ProfileActivity, ProfileGoal, ProfileLevel, ProfileSex } from '@workspace/api-client-react';
import { Activity, ArrowRight, CalendarDays, Check, ChevronDown, Droplets, Dumbbell, Flame, LogOut, Menu, Play, Plus, Salad, TrendingUp, UserRound, Weight, X } from 'lucide-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
const SESSION_KEY = 'fitjournal.session';
if (import.meta.env.VITE_API_BASE_URL) setBaseUrl(import.meta.env.VITE_API_BASE_URL);
setAuthTokenGetter(() => localStorage.getItem(SESSION_KEY));

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function addLocalDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}
const today = () => formatLocalDate(new Date());
const dateLabel = (iso: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) =>
  new Intl.DateTimeFormat('ru-RU', options).format(new Date(`${iso}T12:00:00`));
const dayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const shortDays = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const navItems = [
  { href: '/', label: 'Сегодня', icon: Activity },
  { href: '/week', label: 'Моя неделя', icon: CalendarDays },
  { href: '/workouts', label: 'Тренировки', icon: Dumbbell },
  { href: '/meals', label: 'Питание', icon: Salad },
  { href: '/progress', label: 'Прогресс', icon: TrendingUp },
  { href: '/profile', label: 'Профиль', icon: UserRound },
];

function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="rounded-2xl border border-[#e5b7a9] bg-[#fff4ee] p-5 text-sm text-[#8b3c2c]" role="alert" data-testid="status-api-error">
    <p className="font-bold">Не получилось загрузить данные</p><p className="mt-1 text-[#985c50]">{message}</p>
    {retry && <button onClick={retry} className="mt-3 font-bold underline underline-offset-4" data-testid="button-retry">Попробовать ещё раз</button>}
  </div>;
}
function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="animate-pulse space-y-3" aria-label="Загрузка">
    {Array.from({ length: rows }, (_, i) => <div key={i} className={`${i === 0 ? 'h-32' : 'h-20'} rounded-2xl bg-[#e8e6da]`} />)}
  </div>;
}
function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="mb-5 flex items-end justify-between gap-4"><div>{eyebrow && <p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-primary">{eyebrow}</p>}<h2 className="display text-3xl font-semibold leading-none sm:text-4xl">{title}</h2></div>{action}</div>;
}
function Pill({ children, tone = 'green' }: { children: React.ReactNode; tone?: 'green' | 'orange' | 'muted' }) {
  const styles = { green: 'bg-[#dceee2] text-[#24684a]', orange: 'bg-[#f8e3d8] text-[#a24c32]', muted: 'bg-secondary text-muted-foreground' };
  return <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold ${styles[tone]}`}>{children}</span>;
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();
  const cache = useQueryClient();
  const login = useLoginAccount();
  const register = useRegisterAccount();
  const mutation = mode === 'login' ? login : register;
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    mutation.mutate({ data: { email: email.trim(), password } }, {
      onSuccess: (session) => {
        localStorage.setItem(SESSION_KEY, session.token);
        onAuthenticated(session.token);
        cache.setQueryData(getGetCurrentAccountQueryKey(), session.account);
        setLocation('/');
      },
      onError: (e) => setError(readError(e)),
    });
  };
  return <main className="grain flex min-h-[100dvh] flex-col bg-[#e9e8dc] lg:flex-row">
    <section className="relative flex min-h-[34vh] flex-col justify-between overflow-hidden bg-[#163d32] p-7 text-[#f3f0df] sm:p-12 lg:min-h-[100dvh] lg:w-[46%] lg:p-16">
      <div className="absolute -right-20 top-20 h-80 w-80 rounded-full border border-[#80a88d]/30" /><div className="absolute -right-4 top-36 h-52 w-52 rounded-full border border-[#80a88d]/40" />
      <Link href="/" className="relative z-10 flex items-center gap-3 text-sm font-extrabold tracking-wide"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8a16d] text-[#193d32]"><Activity size={22}/></span>ЛИЧНЫЙ РИТМ</Link>
      <div className="relative z-10 max-w-xl py-8">
        <p className="mono mb-5 text-xs uppercase tracking-[.23em] text-[#a9c5aa]">План. Действие. История.</p>
        <h1 className="display text-5xl font-semibold uppercase leading-[.98] sm:text-7xl">Твой путь<br/><span className="text-[#e8a16d]">в движении.</span></h1>
        <p className="mt-6 max-w-md text-sm leading-7 text-[#d1ddcf]">Тренировки, еда и самочувствие — в одном личном журнале. Продолжай с любого устройства.</p>
      </div>
      <div className="relative z-10 flex items-center gap-3 text-xs text-[#b5c9b5]"><span className="h-px w-9 bg-[#e8a16d]"/>Твоя история всегда с тобой</div>
    </section>
    <section className="flex flex-1 items-center justify-center p-5 sm:p-10">
      <div className="w-full max-w-[420px] rounded-[28px] bg-[#faf9f1] p-6 shadow-[0_22px_60px_rgba(28,54,42,.08)] sm:p-10 rise">
        <p className="mono text-[10px] uppercase tracking-[.2em] text-primary">{mode === 'login' ? 'С возвращением' : 'Начни с малого'}</p>
        <h2 className="display mt-3 text-4xl font-semibold">{mode === 'login' ? 'Войти в журнал' : 'Создать аккаунт'}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Один аккаунт — все твои записи на телефоне и компьютере.</p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block text-xs font-bold">Электронная почта<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="name@example.ru" data-testid="input-email"/></label>
          <label className="block text-xs font-bold">Пароль<input required type="password" minLength={10} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Не менее 10 символов" data-testid="input-password"/></label>
          {error && <p role="alert" className="rounded-xl bg-[#fff0e9] p-3 text-sm text-[#99452f]" data-testid="status-auth-error">{error}</p>}
          <button disabled={mutation.isPending} className="action-button flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground disabled:opacity-60" data-testid="button-auth-submit">
            {mutation.isPending ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}{!mutation.isPending && <ArrowRight size={16}/>}
          </button>
        </form>
        <div className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
          {mode === 'login' ? 'Впервые здесь?' : 'Уже есть аккаунт?'}{' '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="font-extrabold text-primary underline-offset-4 hover:underline" data-testid="button-auth-toggle">
            {mode === 'login' ? 'Создать аккаунт' : 'Войти'}
          </button>
        </div>
        <p className="mt-5 text-center text-[11px] leading-5 text-muted-foreground">Пароль используется только для входа и не сохраняется в журнале.</p>
      </div>
    </section>
  </main>;
}
function readError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = String((error as { message: unknown }).message);
    if (/401|unauthor|invalid|невер/i.test(m)) return 'Проверьте почту и пароль. Если вы здесь впервые, создайте аккаунт.';
    if (/409|exist|already/i.test(m)) return 'Аккаунт с этой почтой уже есть. Попробуйте войти.';
    return m;
  }
  return 'Проверьте подключение и попробуйте ещё раз.';
}

function Sidebar({ email, logout, pending }: { email?: string; logout: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const health = useHealthCheck({ query: { refetchInterval: 60_000 } });
  return <>
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#d8d8ca] bg-[#f6f5eb]/95 px-4 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2 font-extrabold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white"><Activity size={19}/></span>Личный ритм</Link>
      <button aria-label="Открыть меню" onClick={() => setOpen(!open)} className="grid h-10 w-10 place-items-center rounded-xl bg-secondary" data-testid="button-mobile-menu">{open ? <X/> : <Menu/>}</button>
    </header>
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#163d32] px-4 py-6 text-[#e9eee2] transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'} lg:sticky lg:top-0 lg:h-[100dvh]`}>
      <div className="mb-12 flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-3 text-sm font-extrabold tracking-wide" onClick={() => setOpen(false)}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8a16d] text-[#193d32]"><Activity size={22}/></span>ЛИЧНЫЙ РИТМ</Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Закрыть меню"><X size={18}/></button>
      </div>
      <p className="mono px-3 pb-3 text-[9px] uppercase tracking-[.22em] text-[#8da996]">Мой журнал</p>
      <nav className="space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} data-testid={`link-nav-${href.replace('/', 'home')}`} className={`nav-link flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold ${location === href ? 'bg-[#e5a06b] text-[#193d32]' : 'text-[#c3d1c5] hover:bg-white/10 hover:text-white'}`}><Icon size={17}/>{label}{location === href && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#193d32]"/>}</Link>)}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[.06] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#315949]"><UserRound size={15}/></span><span className="max-w-[165px] truncate">{email || 'Мой профиль'}</span></div>
        <p className="mb-2 flex items-center gap-2 px-2 text-[10px] text-[#b5c9b5]" role="status" data-testid="status-api-health"><span className={`h-1.5 w-1.5 rounded-full ${health.isSuccess ? 'bg-[#89d2a1]' : health.isError ? 'bg-[#f3a18b]' : 'bg-[#e8a16d]'}`}/>{health.isSuccess ? 'Сервер подключён' : health.isError ? 'Нет связи с сервером' : 'Подключение к серверу'}</p>
        <button disabled={pending} onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs font-bold text-[#d2ded3] transition hover:bg-white/10 disabled:opacity-50" data-testid="button-logout"><LogOut size={14}/>{pending ? 'Выходим…' : 'Выйти из аккаунта'}</button>
      </div>
      <p className="mono mt-4 px-3 text-[9px] tracking-wide text-[#789583]">ЛИЧНЫЕ ДАННЫЕ. ТВОЙ ТЕМП.</p>
    </aside>
    {open && <button onClick={() => setOpen(false)} aria-label="Закрыть навигацию" className="fixed inset-0 z-30 bg-[#10281f]/40 lg:hidden"/>}
  </>;
}

function PrivateScreen({ children, token, setToken }: { children: ReactNode; token: string | null; setToken: (s: string | null) => void }) {
  const [, setLocation] = useLocation();
  const cache = useQueryClient();
  const account = useGetCurrentAccount({ query: { enabled: !!token, queryKey: getGetCurrentAccountQueryKey() } });
  const logout = useLogoutAccount({ mutation: { onSettled: () => {
    localStorage.removeItem(SESSION_KEY); setToken(null); cache.clear(); setLocation('/login');
  } } });
  if (!token) { setLocation('/login'); return null; }
  if (account.isLoading) return <div className="grid min-h-[100dvh] place-items-center bg-background p-6"><div className="w-full max-w-lg space-y-4"><div className="h-12 w-48 animate-pulse rounded-xl bg-muted"/><Skeleton rows={3}/></div></div>;
  if (account.isError) return <div className="grid min-h-[100dvh] place-items-center p-6"><div className="w-full max-w-md"><ErrorNotice message="Сессия не найдена или сервер временно недоступен." retry={() => account.refetch()}/><button onClick={() => { localStorage.removeItem(SESSION_KEY); setToken(null); setLocation('/login'); }} className="mt-4 rounded-xl bg-primary px-4 py-3 font-bold text-white">Перейти ко входу</button></div></div>;
  return <div className="min-h-[100dvh] bg-background lg:flex">
    <Sidebar email={account.data?.email} logout={() => logout.mutate()} pending={logout.isPending}/>
    <main className="min-w-0 flex-1"><div className="mx-auto max-w-[1400px] px-4 pb-12 pt-7 sm:px-8 lg:px-10 lg:pt-10">{children}</div></main>
  </div>;
}
function useAppData() {
  const overview = useGetOverview({ date: today() }, { query: { queryKey: getGetOverviewQueryKey({ date: today() }) } });
  const plan = useGetWeekPlan({ query: { queryKey: getGetWeekPlanQueryKey() } });
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const water = useGetWater({ date: today() }, { query: { queryKey: getGetWaterQueryKey({ date: today() }) } });
  const completions = useGetCompletions({ from: firstDay(), to: today() }, { query: { queryKey: getGetCompletionsQueryKey({ from: firstDay(), to: today() }) } });
  const workouts = useGetWorkouts({ query: { queryKey: getGetWorkoutsQueryKey() } });
  return { overview, plan, profile, water, completions, workouts };
}
function firstDay() {
  return addLocalDays(today(), -6);
}
function weekStart() {
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return formatLocalDate(d);
}

function HomePage() {
  const { overview, plan, profile, water, completions, workouts } = useAppData();
  const addWater = useAddWater();
  const addCompletion = useAddCompletion();
  const cache = useQueryClient();
  const [waterError, setWaterError] = useState('');
  const refreshHome = () => {
    cache.invalidateQueries({ queryKey: getGetOverviewQueryKey({ date: today() }) });
    cache.invalidateQueries({ queryKey: getGetWaterQueryKey({ date: today() }) });
    cache.invalidateQueries({ queryKey: getGetCompletionsQueryKey({ from: firstDay(), to: today() }) });
  };
  const days = plan.data?.week || [];
  const dayIndex = (new Date().getDay() + 6) % 7;
  const todayPlan = days.find(d => d.day === dayIndex + 1);
  const goal = water.data?.goalMl ?? overview.data?.waterGoalMl ?? 0;
  const total = water.data?.totalMl ?? overview.data?.todayWaterMl ?? 0;
  const percent = goal ? Math.min(100, Math.round(total / goal * 100)) : 0;
  const doneIds = new Set(completions.data?.filter(c => c.date === today()).map(c => c.workoutId) || []);
  const failed = [overview.isError, plan.isError, water.isError, profile.isError, completions.isError, workouts.isError].some(Boolean);
  if (overview.isLoading || plan.isLoading) return <><SectionTitle eyebrow="Личный ритм / сегодня" title="Доброе утро."/><Skeleton rows={4}/></>;
  if (failed && !overview.data) return <ErrorNotice message="Обзор пока недоступен. Ваши записи не потеряны." retry={() => { overview.refetch(); plan.refetch(); }}/>;
  return <div className="space-y-9">
    <header className="rise flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">{dateLabel(today(), { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1 className="display text-5xl font-semibold leading-none sm:text-6xl">Держи свой<br className="sm:hidden"/> <span className="text-primary">ритм.</span></h1><p className="mt-3 text-sm text-muted-foreground">Один шаг сегодня — заметная разница со временем.</p></div>
      <Link href="/week" className="action-button inline-flex items-center gap-2 self-start rounded-xl bg-[#173d32] px-4 py-3 text-xs font-extrabold text-[#f4f0df] sm:self-auto" data-testid="link-week-from-home">План недели <ArrowRight size={15}/></Link>
    </header>
    {failed && <ErrorNotice message="Часть данных не загрузилась. Остальное доступно." retry={refreshHome}/>}
    <div className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
      <section className="relative overflow-hidden rounded-[26px] bg-[#194638] p-6 text-[#f3f0df] sm:p-8 rise">
        <div className="absolute -right-12 -top-24 h-64 w-64 rounded-full border border-[#b1c7a7]/20"/><div className="absolute right-10 top-10 h-36 w-36 rounded-full border border-[#b1c7a7]/20"/>
        <div className="relative flex items-start justify-between gap-4"><div><Pill tone="orange">ПЛАН НА СЕГОДНЯ</Pill><h2 className="display mt-5 text-4xl font-semibold">{todayPlan?.title || (todayPlan?.rest ? 'День восстановления' : 'Тренировка')}</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#c4d6c7]">{todayPlan?.note || (todayPlan?.rest ? 'Дай телу восстановиться — это тоже часть плана.' : todayPlan?.items?.length ? 'План готов. Выбери упражнение и начинай в своём темпе.' : 'На сегодня пока нет запланированных упражнений.')}</p></div><span className="hidden h-14 w-14 place-items-center rounded-2xl bg-white/10 sm:grid"><Dumbbell/></span></div>
        <div className="relative mt-7 space-y-2">
          {todayPlan?.items?.length ? todayPlan.items.map((item, i) => <div key={`${item.workoutId}-${i}`} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[.06] p-4 sm:flex-row sm:items-center">
            <span className="mono grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e5a06b] text-xs font-bold text-[#173d32]">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0 flex-1"><p className="font-extrabold">{item.title}</p><p className="mt-1 text-xs text-[#bfd1c3]">{item.durationMin} минут {item.notes ? `· ${item.notes}` : ''}</p></div>
            <button onClick={() => {
              const already = doneIds.has(item.workoutId);
              if (already) return;
              addCompletion.mutate({ data: { workoutId: item.workoutId, date: today() } }, { onSuccess: refreshHome });
            }} disabled={doneIds.has(item.workoutId) || addCompletion.isPending} className={`action-button flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold ${doneIds.has(item.workoutId) ? 'bg-[#c5e0ca] text-[#214e39]' : 'bg-[#e5a06b] text-[#173d32]'}`} data-testid={`button-complete-${item.workoutId}`}>
              {doneIds.has(item.workoutId) ? <><Check size={14}/>Готово</> : <>Отметить <ArrowRight size={14}/></>}
            </button>
          </div>) : <div className="rounded-2xl border border-white/10 bg-white/[.06] p-5 text-sm text-[#d0dfd2]">{todayPlan?.rest ? 'Сегодня можно восстановиться и набраться сил.' : todayPlan?.note || 'План на этот день не заполнен.'}</div>}
        </div>
        <Link href="/workouts" className="relative mt-5 inline-flex items-center gap-2 text-xs font-extrabold text-[#e7a16b] hover:gap-3" data-testid="link-workouts">Открыть каталог <ArrowRight size={14}/></Link>
      </section>
      <section className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
        <div className="flex items-center justify-between"><div><p className="mono text-[10px] uppercase tracking-[.19em] text-primary">Баланс дня</p><h2 className="display mt-2 text-3xl font-semibold">Вода</h2></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#dceee2] text-primary"><Droplets/></span></div>
        <div className="mt-5 flex items-center gap-5">
          <div className="relative grid h-32 w-32 shrink-0 place-items-center"><svg className="water-ring absolute inset-0" viewBox="0 0 100 100"><circle cx="50" cy="50" r="43" fill="none" stroke="#e9e8de" strokeWidth="8"/><circle cx="50" cy="50" r="43" fill="none" stroke="#279767" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${percent * 2.7} 270`}/></svg><div className="text-center"><p className="display text-3xl font-semibold">{percent}<span className="text-base">%</span></p><p className="mono text-[9px] text-muted-foreground">ЦЕЛЬ</p></div></div>
          <div><p className="display text-2xl font-semibold">{(total / 1000).toFixed(1)} л</p><p className="mt-1 text-xs text-muted-foreground">из {(goal / 1000).toFixed(1)} л за день</p><p className="mono mt-3 text-[10px] text-muted-foreground">{Math.max(0, goal - total)} мл осталось</p></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">{[250, 500].map(ml => <button key={ml} disabled={addWater.isPending || !water.data} onClick={() => addWater.mutate({ data: { date: today(), ml } }, { onSuccess: refreshHome, onError: () => setWaterError('Не удалось добавить воду. Попробуйте ещё раз.') })} className="action-button flex items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-xs font-extrabold text-secondary-foreground disabled:opacity-50" data-testid={`button-water-${ml}`}><Plus size={14}/>{ml} мл</button>)}</div>
        {waterError && <p className="mt-2 text-xs text-destructive" role="alert">{waterError}</p>}
      </section>
    </div>
    <section>
      <SectionTitle eyebrow="Неделя · короткий обзор" title="Собранный темп." action={<Link href="/progress" className="text-xs font-extrabold text-primary">Вся статистика <ArrowRight className="ml-1 inline" size={14}/></Link>}/>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Тренировок всего" value={overview.data?.totalCompleted ?? 0} unit="занятий" icon={<Dumbbell size={18}/>} tone="green"/>
        <MetricCard label="Серия сейчас" value={overview.data?.streak ?? 0} unit="дней подряд" icon={<Flame size={18}/>} tone="orange"/>
        <MetricCard label="Вес сейчас" value={overview.data?.latestWeightKg ?? '—'} unit={overview.data?.latestWeightKg ? 'кг' : 'добавьте запись'} icon={<Weight size={18}/>} tone="cream"/>
      </div>
    </section>
    <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <div className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
        <SectionTitle eyebrow="Ближайшие дни" title="На этой неделе" action={<Link href="/week" className="text-xs font-extrabold text-primary">Открыть <ArrowRight className="ml-1 inline" size={14}/></Link>}/>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">{dayNames.map((day, i) => {
          const entry = days.find(d => d.day === i + 1);
          const isToday = i === dayIndex;
          return <div key={day} className={`min-h-[92px] rounded-xl p-2 text-center sm:p-3 ${isToday ? 'bg-primary text-primary-foreground' : 'bg-background'}`}><p className={`mono text-[9px] ${isToday ? 'text-white/70' : 'text-muted-foreground'}`}>{shortDays[i]}</p><p className="mt-2 text-xs font-extrabold leading-tight">{entry?.rest ? 'Отдых' : entry?.items?.length ? `${entry.items.length} зан.` : '—'}</p><span className={`mx-auto mt-2 block h-1.5 w-1.5 rounded-full ${entry?.rest ? 'bg-[#e5a06b]' : entry?.items?.length ? (isToday ? 'bg-white' : 'bg-primary') : 'bg-transparent'}`}/></div>;
        })}</div>
      </div>
      <div className="rounded-[26px] bg-[#e8a16d] p-6 text-[#2f3b30] sm:p-7">
        <p className="mono text-[10px] uppercase tracking-[.18em]">Твоя опора</p><h3 className="display mt-3 text-3xl font-semibold">Ритм важнее рывка.</h3><p className="mt-3 text-sm leading-6 text-[#584b3e]">Повторяемость превращает план в привычку. Отмечай то, что сделал, и смотри на свою дистанцию.</p>
        <Link href="/progress" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173d32] px-4 py-3 text-xs font-extrabold text-white" data-testid="link-progress-card">Мои результаты <ArrowRight size={14}/></Link>
      </div>
    </section>
  </div>;
}
function MetricCard({ label, value, unit, icon, tone }: { label: string; value: ReactNode; unit: string; icon: ReactNode; tone: string }) {
  const colors: Record<string, string> = { green: 'bg-[#dceee2] text-primary', orange: 'bg-[#f8e3d8] text-[#a24c32]', cream: 'bg-[#eee7cf] text-[#846c31]' };
  return <div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold text-muted-foreground">{label}</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[tone]}`}>{icon}</span></div><div className="mt-4 flex items-baseline gap-2"><span className="display text-4xl font-semibold">{value}</span><span className="text-xs text-muted-foreground">{unit}</span></div></div>;
}

function WeekPage() {
  const plan = useGetWeekPlan({ query: { queryKey: getGetWeekPlanQueryKey() } });
  const start = weekStart();
  const completions = useGetCompletions({ from: start, to: today() }, { query: { queryKey: getGetCompletionsQueryKey({ from: start, to: today() }) } });
  const add = useAddCompletion(); const remove = useDeleteCompletion(); const cache = useQueryClient();
  const invalidate = () => cache.invalidateQueries({ queryKey: getGetCompletionsQueryKey({ from: start, to: today() }) });
  if (plan.isLoading) return <><SectionTitle eyebrow="Планирование" title="Неделя в движении"/><Skeleton rows={5}/></>;
  if (plan.isError) return <><SectionTitle eyebrow="Планирование" title="Неделя в движении"/><ErrorNotice message="Не удалось получить недельный план." retry={() => plan.refetch()}/></>;
  const week = plan.data?.week || [];
  if (!week.length) return <><SectionTitle eyebrow="Планирование" title="Неделя в движении"/><EmptyState title="План пока пуст" text="Когда недельный план будет доступен, здесь появятся тренировки и дни восстановления."/></>;
  return <div className="space-y-7">
    <div className="rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Твой график · 7 дней</p><h1 className="display text-5xl font-semibold">Неделя в движении</h1><p className="mt-3 text-sm text-muted-foreground">Выполнено <b className="text-foreground">{completions.data?.length ?? 0}</b> занятий за последние 7 дней.</p></div><Pill>{week.length} дней в плане</Pill></div>
    {completions.isError && <ErrorNotice message="История выполнения временно недоступна." retry={() => completions.refetch()}/>}
    <div className="space-y-3">{week.map((day, i) => {
      const idx = Math.min(Math.max(day.day - 1, 0), 6);
      const iso = addLocalDays(weekStart(), idx);
      const done = completions.data?.filter(c => c.date === iso) || [];
      return <section key={`${day.day}-${i}`} className={`grid gap-4 rounded-[22px] border p-5 sm:grid-cols-[150px_1fr] sm:p-6 ${idx === (new Date().getDay() + 6) % 7 ? 'border-primary/40 bg-[#e8f0e4]' : 'border-border bg-card'}`}>
        <div className="flex items-start justify-between sm:block"><div><p className="mono text-[10px] uppercase tracking-[.16em] text-primary">{shortDays[idx]} · {dateLabel(iso, { day: 'numeric', month: 'short' })}</p><h2 className="display mt-2 text-2xl font-semibold">{dayNames[idx]}</h2></div>{idx === (new Date().getDay() + 6) % 7 && <Pill>СЕГОДНЯ</Pill>}</div>
        <div>
          <div className="mb-3 flex items-center gap-2"><h3 className="font-extrabold">{day.title}</h3>{day.rest && <Pill tone="orange">Восстановление</Pill>}</div>
          {day.note && <p className="mb-3 text-sm leading-6 text-muted-foreground">{day.note}</p>}
          {!day.rest && day.items.length === 0 && <p className="rounded-xl bg-background p-4 text-sm text-muted-foreground">Для этого дня упражнения не указаны.</p>}
          <div className="space-y-2">{day.items.map((item, j) => {
            const match = done.find(c => c.workoutId === item.workoutId);
            return <div key={`${item.workoutId}-${j}`} className="flex flex-col gap-3 rounded-xl bg-background px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.durationMin} минут{item.notes ? ` · ${item.notes}` : ''}</p></div>
              {match ? <button onClick={() => remove.mutate({ id: match.id }, { onSuccess: invalidate })} disabled={remove.isPending} className="flex items-center justify-center gap-1.5 self-start rounded-lg bg-[#dceee2] px-3 py-2 text-[11px] font-extrabold text-primary sm:self-auto" data-testid={`button-uncomplete-${match.id}`}><Check size={13}/>Выполнено</button> :
              <button onClick={() => add.mutate({ data: { workoutId: item.workoutId, date: iso } }, { onSuccess: invalidate })} disabled={add.isPending} className="flex items-center justify-center gap-1.5 self-start rounded-lg border border-border px-3 py-2 text-[11px] font-extrabold text-muted-foreground transition hover:border-primary hover:text-primary sm:self-auto" data-testid={`button-complete-week-${item.workoutId}-${day.day}`}><Plus size={13}/>Отметить</button>}
            </div>;
          })}</div>
        </div>
      </section>;
    })}</div>
  </div>;
}

function WorkoutsPage() {
  const workouts = useGetWorkouts({ query: { queryKey: getGetWorkoutsQueryKey() } });
  const [category, setCategory] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const options = [
    ['all', 'Все'], ['tabata', 'Табата'], ['cardio', 'Кардио'], ['fullbody', 'Всё тело'], ['upper', 'Верх тела'],
  ];
  const filtered = useMemo(() => (workouts.data || []).filter(w => category === 'all' || w.category === category), [workouts.data, category]);
  const current = filtered.find(w => w.id === selected) || workouts.data?.find(w => w.id === selected);
  if (workouts.isLoading) return <><SectionTitle eyebrow="Видео-каталог" title="Выбирай и двигайся"/><Skeleton rows={4}/></>;
  if (workouts.isError) return <><SectionTitle eyebrow="Видео-каталог" title="Выбирай и двигайся"/><ErrorNotice message="Каталог временно недоступен." retry={() => workouts.refetch()}/></>;
  return <div className="space-y-7">
    <header className="rise"><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Видео-каталог</p><h1 className="display text-5xl font-semibold sm:text-6xl">Выбирай и двигайся.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Подборка тренировок из твоего каталога. Смотри видео, сохраняй свой темп.</p></header>
    <div className="flex gap-2 overflow-x-auto pb-2">{options.map(([key, label]) => <button key={key} onClick={() => setCategory(key)} className={`whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-extrabold transition ${category === key ? 'bg-[#173d32] text-white' : 'bg-card text-muted-foreground hover:text-foreground'}`} data-testid={`button-filter-${key}`}>{label}</button>)}</div>
    {!filtered.length ? <EmptyState title="В этой категории пока нет видео" text="Выберите другой тип тренировки или вернитесь позже."/> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((workout, index) => <article key={workout.id} className="group overflow-hidden rounded-[22px] border border-border bg-card rise" style={{ animationDelay: `${index * 55}ms` }}>
        <button onClick={() => setSelected(workout.id)} className="relative block aspect-[16/9] w-full overflow-hidden bg-[#23483c] text-left" aria-label={`Открыть видео: ${workout.title}`} data-testid={`button-play-${workout.id}`}>
          <img src={`https://img.youtube.com/vi/${encodeURIComponent(workout.youtubeId)}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-90"/>
          <span className="absolute inset-0 grid place-items-center bg-[#173d32]/15"><span className="grid h-14 w-14 place-items-center rounded-full bg-[#e5a06b] text-[#173d32] transition group-hover:scale-110"><Play size={22} fill="currentColor"/></span></span>
          <span className="mono absolute bottom-3 right-3 rounded-md bg-[#173d32]/90 px-2 py-1 text-[10px] text-white">{workout.durationMin} мин</span>
        </button>
        <div className="p-5"><div className="mb-3 flex items-center justify-between"><Pill>{categoryLabel(workout.category)}</Pill><span className="mono text-[10px] text-muted-foreground">ТРЕНИРОВКА {String(index + 1).padStart(2, '0')}</span></div>
          <h2 className="display text-2xl font-semibold">{workout.title}</h2>{workout.notes && <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{workout.notes}</p>}
          <button onClick={() => setSelected(workout.id)} className="mt-4 flex items-center gap-2 text-xs font-extrabold text-primary" data-testid={`button-open-video-${workout.id}`}>Смотреть видео <ArrowRight size={14}/></button>
        </div>
      </article>)}</div>}
    {current && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#112a21]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={current.title} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-[#102d24] shadow-2xl"><div className="flex items-center justify-between p-4 text-white"><div><p className="mono text-[9px] uppercase tracking-widest text-[#a9c5aa]">{categoryLabel(current.category)} · {current.durationMin} минут</p><h2 className="mt-1 font-bold">{current.title}</h2></div><button onClick={() => setSelected(null)} aria-label="Закрыть видео" className="grid h-9 w-9 place-items-center rounded-full bg-white/10" data-testid="button-close-video"><X/></button></div>
        <div className="aspect-video bg-black"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(current.youtubeId)}?autoplay=1`} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div>
      </div>
    </div>}
  </div>;
}
function categoryLabel(category: string) { return ({ tabata: 'Табата', cardio: 'Кардио', fullbody: 'Всё тело', upper: 'Верх тела' } as Record<string, string>)[category] || category; }

function MealsPage() {
  const meals = useGetMeals({ query: { queryKey: getGetMealsQueryKey() } });
  const [selected, setSelected] = useState<string | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const mealNames: Record<string, string> = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
  const list = meals.data || [];
  const chosen = list.find(m => m.id === selected);
  const shopping = useMemo(() => {
    const amounts = new Map<string, { amount: number; unit: string }>();
    list.forEach(meal => meal.ingredients.forEach(ingredient => {
      const key = ingredient.name.trim().toLocaleLowerCase('ru');
      const old = amounts.get(key);
      if (old && old.unit === ingredient.unit) old.amount += ingredient.amount * 7;
      else if (!old) amounts.set(key, { amount: ingredient.amount * 7, unit: ingredient.unit });
    }));
    return [...amounts.entries()].map(([name, data]) => ({ name, ...data }));
  }, [list]);
  if (meals.isLoading) return <><SectionTitle eyebrow="Питание" title="Еда, которая поддерживает"/><Skeleton rows={4}/></>;
  if (meals.isError) return <><SectionTitle eyebrow="Питание" title="Еда, которая поддерживает"/><ErrorNotice message="План питания временно недоступен." retry={() => meals.refetch()}/></>;
  if (!list.length) return <><SectionTitle eyebrow="Питание" title="Еда, которая поддерживает"/><EmptyState title="План питания пока пуст" text="Рецепты появятся здесь, когда будут доступны в вашем плане."/></>;
  const order = ['breakfast', 'lunch', 'snack', 'dinner'];
  const ordered = [...list].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  return <div className="space-y-7">
    <header className="rise flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Питание · рецепты</p><h1 className="display text-5xl font-semibold sm:text-6xl">Еда, которая<br className="sm:hidden"/> поддерживает.</h1><p className="mt-3 text-sm text-muted-foreground">Простой план с понятными продуктами и шагами.</p></div><button onClick={() => setShoppingOpen(true)} className="action-button flex items-center justify-center gap-2 self-start rounded-xl bg-[#173d32] px-4 py-3 text-xs font-extrabold text-white sm:self-auto" data-testid="button-shopping-list"><Check size={15}/>Список покупок на 7 дней</button></header>
    <div className="grid gap-4 lg:grid-cols-2">{ordered.map((meal, index) => <MealCard key={meal.id} meal={meal} index={index} onOpen={() => setSelected(meal.id)}/>)}</div>
    <div className="rounded-[26px] bg-[#e8a16d] p-6 sm:flex sm:items-center sm:justify-between sm:p-8"><div><p className="mono text-[10px] uppercase tracking-[.18em]">План на каждый день</p><h2 className="display mt-2 text-3xl font-semibold">Повторяй меню в своём темпе.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#584b3e]">Список покупок рассчитан на семь повторений этого набора рецептов. Количество можно подстроить под себя.</p></div><button onClick={() => setShoppingOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#173d32] px-4 py-3 text-xs font-extrabold text-white sm:mt-0" data-testid="button-shopping-list-bottom">К продуктам <ArrowRight size={14}/></button></div>
    {chosen && <MealDialog meal={chosen} onClose={() => setSelected(null)}/>}
    {shoppingOpen && <ShoppingDialog list={shopping} onClose={() => setShoppingOpen(false)}/>}
  </div>;
}
function MealCard({ meal, index, onOpen }: { meal: Meal; index: number; onOpen: () => void }) {
  const tint = ['bg-[#e8e5d2]', 'bg-[#dceee2]', 'bg-[#f5e2d7]', 'bg-[#dce8e7]'][index % 4];
  return <article className="flex flex-col overflow-hidden rounded-[24px] border border-border bg-card sm:flex-row rise" style={{ animationDelay: `${index * 65}ms` }}>
    <div className={`relative flex min-h-[170px] flex-col justify-between p-5 sm:w-[37%] ${tint}`}><div className="flex justify-between"><Pill>{({ breakfast: 'ЗАВТРАК', lunch: 'ОБЕД', dinner: 'УЖИН', snack: 'ПЕРЕКУС' } as Record<string, string>)[meal.type] || meal.type}</Pill><span className="mono text-[10px] text-foreground/60">{String(index + 1).padStart(2, '0')}</span></div><div className="display text-[86px] font-semibold leading-[.9] text-[#214c3c]/20">{meal.type === 'breakfast' ? '01' : meal.type === 'lunch' ? '02' : meal.type === 'dinner' ? '03' : '04'}</div></div>
    <div className="flex flex-1 flex-col p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><h2 className="display text-2xl font-semibold leading-tight">{meal.name}</h2><button onClick={onOpen} aria-label={`Открыть рецепт: ${meal.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary transition hover:bg-primary hover:text-white" data-testid={`button-meal-${meal.id}`}><ArrowRight size={16}/></button></div>
      <div className="mono mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-muted-foreground"><span>{meal.kcal} ккал</span><span>{meal.protein} г белка</span><span>{meal.prepMin} мин</span></div>
      <p className="mt-4 line-clamp-2 text-xs leading-5 text-muted-foreground">{meal.ingredients.slice(0, 4).map(i => i.name).join(' · ')}</p>
      <button onClick={onOpen} className="mt-auto pt-4 text-left text-xs font-extrabold text-primary" data-testid={`button-recipe-${meal.id}`}>Посмотреть рецепт</button>
    </div>
  </article>;
}
function MealDialog({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#112a21]/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={meal.name} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-[26px] bg-card p-6 sm:rounded-[26px] sm:p-8">
      <div className="flex items-start justify-between gap-3"><div><Pill>{mealNamesRu(meal.type)}</Pill><h2 className="display mt-3 text-3xl font-semibold">{meal.name}</h2></div><button onClick={onClose} aria-label="Закрыть рецепт" className="grid h-9 w-9 place-items-center rounded-full bg-secondary" data-testid="button-close-recipe"><X size={18}/></button></div>
      <div className="mono mt-4 flex gap-4 text-xs text-muted-foreground">{meal.kcal} ккал <span>{meal.protein} г белка</span><span>{meal.prepMin} минут</span></div>
      <h3 className="display mt-7 text-xl font-semibold">Что понадобится</h3><ul className="mt-3 divide-y divide-border">{meal.ingredients.map((ingredient, i) => <li key={`${ingredient.name}-${i}`} className="flex justify-between py-2.5 text-sm"><span>{ingredient.name}</span><span className="mono text-xs text-muted-foreground">{ingredient.amount} {ingredient.unit}</span></li>)}</ul>
      <h3 className="display mt-6 text-xl font-semibold">Как приготовить</h3><p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">{meal.steps}</p>
    </div>
  </div>;
}
function mealNamesRu(type: string) { return ({ breakfast: 'ЗАВТРАК', lunch: 'ОБЕД', dinner: 'УЖИН', snack: 'ПЕРЕКУС' } as Record<string, string>)[type] || type; }
function ShoppingDialog({ list, onClose }: { list: { name: string; amount: number; unit: string }[]; onClose: () => void }) {
  const [checked, setChecked] = useState<string[]>([]);
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#112a21]/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Список покупок на 7 дней" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-[26px] bg-card p-6 sm:rounded-[26px] sm:p-8">
      <div className="flex justify-between gap-3"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">Меню × 7 дней</p><h2 className="display mt-2 text-3xl font-semibold">Список покупок</h2></div><button onClick={onClose} aria-label="Закрыть список" className="grid h-9 w-9 place-items-center rounded-full bg-secondary" data-testid="button-close-shopping"><X size={18}/></button></div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Количество рассчитано на семь повторений набора рецептов. Отметки сохраняются только пока список открыт.</p>
      {!list.length ? <EmptyState title="Нет ингредиентов" text="В рецептах пока не указаны продукты."/> : <div className="mt-5 divide-y divide-border">{list.map(item => {
        const active = checked.includes(item.name);
        return <label key={item.name} className={`flex cursor-pointer items-center justify-between gap-3 py-3 ${active ? 'opacity-50' : ''}`}><span className="flex items-center gap-3 text-sm"><input type="checkbox" checked={active} onChange={() => setChecked(active ? checked.filter(v => v !== item.name) : [...checked, item.name])} className="h-4 w-4 accent-[#218359]" data-testid={`checkbox-shopping-${item.name}`}/><span className={active ? 'line-through' : ''}>{item.name}</span></span><span className="mono text-xs text-muted-foreground">{item.amount} {item.unit}</span></label>;
      })}</div>}
      <button onClick={onClose} className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-extrabold text-white" data-testid="button-shopping-done">Готово</button>
    </div>
  </div>;
}

function ProgressPage() {
  const overview = useGetOverview({ date: today() }, { query: { queryKey: getGetOverviewQueryKey({ date: today() }) } });
  const weights = useGetWeights({ query: { queryKey: getGetWeightsQueryKey() } });
  const from = useMemo(() => addLocalDays(today(), -29), []);
  const analytics = useGetAnalytics({ from, to: today() }, { query: { queryKey: getGetAnalyticsQueryKey({ from, to: today() }) } });
  const saveWeight = useSaveWeight(); const cache = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [kg, setKg] = useState('');
  const [weightError, setWeightError] = useState('');
  const error = overview.isError || weights.isError || analytics.isError;
  const days = analytics.data?.days || [];
  const maxWorkouts = Math.max(1, ...days.map(day => day.workouts));
  const maxWater = Math.max(1, ...days.map(day => day.waterMl));
  const weightHistory = (weights.data || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (overview.isLoading || weights.isLoading || analytics.isLoading) return <><SectionTitle eyebrow="Личная история" title="Прогресс без догадок"/><Skeleton rows={4}/></>;
  const refresh = () => { cache.invalidateQueries({ queryKey: getGetWeightsQueryKey() }); cache.invalidateQueries({ queryKey: getGetOverviewQueryKey({ date: today() }) }); cache.invalidateQueries({ queryKey: getGetAnalyticsQueryKey({ from, to: today() }) }); };
  return <div className="space-y-8">
    <header className="rise flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Твоя дистанция</p><h1 className="display text-5xl font-semibold sm:text-6xl">Прогресс без догадок.</h1><p className="mt-3 text-sm text-muted-foreground">Смотри на факты. Замечай то, что уже изменилось.</p></div><button onClick={() => { setShowForm(!showForm); setWeightError(''); }} className="action-button flex items-center justify-center gap-2 self-start rounded-xl bg-primary px-4 py-3 text-xs font-extrabold text-white sm:self-auto" data-testid="button-add-weight"><Plus size={15}/>Добавить вес</button></header>
    {error && <ErrorNotice message="Некоторые показатели не загрузились." retry={() => { overview.refetch(); weights.refetch(); analytics.refetch(); }}/>}
    {showForm && <form onSubmit={e => { e.preventDefault(); setWeightError(''); saveWeight.mutate({ data: { date: today(), kg: Number(kg) } }, { onSuccess: () => { refresh(); setShowForm(false); setKg(''); }, onError: () => setWeightError('Запись веса не сохранилась. Попробуйте ещё раз.') }); }} className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-card p-4 sm:flex-row sm:items-end" data-testid="form-weight">
      <label className="flex-1 text-xs font-bold">Вес сегодня, кг<input type="number" min="30" max="250" step="0.1" required value={kg} onChange={e => setKg(e.target.value)} placeholder="Например, 68.4" className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" data-testid="input-weight"/></label>
      <button disabled={saveWeight.isPending} className="h-11 rounded-xl bg-primary px-5 text-xs font-extrabold text-white disabled:opacity-50" data-testid="button-save-weight">{saveWeight.isPending ? 'Сохраняем…' : 'Сохранить запись'}</button>
      {weightError && <p className="text-xs text-destructive" role="alert">{weightError}</p>}
    </form>}
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label="Всего занятий" value={overview.data?.totalCompleted ?? '—'} unit="за всё время" icon={<Dumbbell size={18}/>} tone="green"/>
      <MetricCard label="Текущая серия" value={overview.data?.streak ?? '—'} unit="дней" icon={<Flame size={18}/>} tone="orange"/>
      <MetricCard label="Лучшая серия" value={overview.data?.bestStreak ?? '—'} unit="дней" icon={<TrendingUp size={18}/>} tone="cream"/>
    </div>
    <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
        <SectionTitle eyebrow="Последние 30 дней" title="Активность"/>
        {days.length ? <div className="mt-6"><div className="flex h-[170px] items-end gap-[3px] border-b border-border pb-2 sm:gap-1">{days.map((day, i) => <div key={day.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(day.date)} · ${day.workouts} тренировок`}>
          {day.workouts > 0 && <div className="mx-auto w-full max-w-4 rounded-t-sm bg-primary transition-all group-hover:bg-[#e8a16d]" style={{ height: `${Math.max(5, day.workouts / maxWorkouts * 100)}%` }}/>}
          {day.workouts === 0 && <div className="mx-auto w-full max-w-4 rounded-t-sm bg-secondary" style={{ height: '3px' }}/>}
        </div>)}</div><div className="mt-3 flex justify-between text-[9px] text-muted-foreground"><span>{dateLabel(days[0].date, { day: 'numeric', month: 'short' })}</span><span>Тренировки по дням</span><span>{dateLabel(days[days.length - 1].date, { day: 'numeric', month: 'short' })}</span></div></div>
        : <EmptyState title="История пока собирается" text="Когда появятся записи, здесь будет видна динамика занятий."/>}
      </div>
      <div className="rounded-[26px] bg-[#173d32] p-6 text-[#f4f0df] sm:p-7"><SectionTitle eyebrow="Вода · последние 30 дней" title="Гидратация"/>
        {days.length ? <><div className="mt-7 flex h-[160px] items-end gap-[3px] sm:gap-1">{days.map(day => <div key={`${day.date}-water`} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(day.date)} · ${day.waterMl} мл`}><div className="mx-auto w-full max-w-4 rounded-t-sm bg-[#e8a16d] transition group-hover:bg-[#f2c09b]" style={{ height: `${day.waterMl ? Math.max(5, day.waterMl / maxWater * 100) : 3}%` }}/></div>)}</div><div className="mt-3 flex justify-between text-[9px] text-[#b7cabe]"><span>{days[0] && dateLabel(days[0].date, { day: 'numeric', month: 'short' })}</span><span>Мл воды в день</span><span>{days.length && dateLabel(days[days.length - 1].date, { day: 'numeric', month: 'short' })}</span></div></> : <p className="mt-5 text-sm text-[#b7cabe]">Пока нет записей о воде за этот период.</p>}
      </div>
    </section>
    <section className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-primary">Измерения</p><h2 className="display mt-2 text-3xl font-semibold">История веса</h2></div>{weightHistory.length > 0 && <p className="mono text-xs text-muted-foreground">{weightHistory.length} {plural(weightHistory.length, 'запись', 'записи', 'записей')}</p>}</div>
      {!weightHistory.length ? <EmptyState title="Добавьте первое измерение" text="Вес будет отображаться в личной истории. Записывайте его в удобном для вас ритме."/> :
        <div className="mt-5">
          {weightHistory.length > 1 && <WeightLine entries={weightHistory}/>}
          <div className="mt-4 divide-y divide-border">{weightHistory.slice(-8).reverse().map(item => <div key={item.id} className="flex items-center justify-between py-3" data-testid={`row-weight-${item.id}`}><span className="text-sm text-muted-foreground">{dateLabel(item.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span><span className="display text-2xl font-semibold">{item.kg.toFixed(1)} <small className="mono text-[10px] text-muted-foreground">КГ</small></span></div>)}</div>
        </div>}
    </section>
  </div>;
}
function WeightLine({ entries }: { entries: { id: string; date: string; kg: number }[] }) {
  const values = entries.map(item => item.kg); const min = Math.min(...values) - .5; const max = Math.max(...values) + .5; const span = Math.max(1, max - min);
  const points = entries.map((item, i) => `${(i / Math.max(1, entries.length - 1)) * 100},${88 - ((item.kg - min) / span) * 76}`).join(' ');
  return <div className="h-32 overflow-hidden rounded-2xl bg-background p-3"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full"><polyline points={points} fill="none" stroke="#26835b" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>{entries.map((entry, i) => <circle key={entry.id} cx={(i / Math.max(1, entries.length - 1)) * 100} cy={88 - ((entry.kg - min) / span) * 76} r="1.6" fill="#e8a16d" vectorEffect="non-scaling-stroke"/>)}</svg></div>;
}
function plural(value: number, one: string, few: string, many: string) {
  const n = Math.abs(value) % 100; const last = n % 10;
  return n > 10 && n < 20 ? many : last > 1 && last < 5 ? few : last === 1 ? one : many;
}

function ProfilePage() {
  const profileQuery = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const account = useGetCurrentAccount({ query: { queryKey: getGetCurrentAccountQueryKey() } });
  const save = useSaveProfile(); const cache = useQueryClient();
  const [form, setForm] = useState<Profile>({
    sex: 'female', age: 30, heightCm: 165, weightKg: 65, activity: 1.2, goal: 'maintain', level: 'beginner',
  });
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  if (profileQuery.data?.profile && !loaded) { setForm(profileQuery.data.profile); setLoaded(true); }
  const profile = profileQuery.data?.profile;
  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setForm(prev => ({ ...prev, [key]: value }));
  if (profileQuery.isLoading) return <><SectionTitle eyebrow="Профиль" title="Твоя база"/><Skeleton rows={4}/></>;
  if (profileQuery.isError) return <><SectionTitle eyebrow="Профиль" title="Твоя база"/><ErrorNotice message="Не удалось загрузить настройки профиля." retry={() => profileQuery.refetch()}/></>;
  return <div className="space-y-7">
    <header className="rise"><p className="mono mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Настройки и ориентиры</p><h1 className="display text-5xl font-semibold sm:text-6xl">Твоя база.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Личные параметры помогают подстроить питание и нагрузку под тебя.</p></header>
    <form onSubmit={e => { e.preventDefault(); setNotice(''); save.mutate({ data: form }, { onSuccess: () => { cache.invalidateQueries({ queryKey: getGetProfileQueryKey() }); cache.invalidateQueries({ queryKey: getGetOverviewQueryKey({ date: today() }) }); setNotice('Профиль сохранён.'); }, onError: () => setNotice('Не удалось сохранить. Проверьте значения и попробуйте снова.') }); }} className="grid gap-5 lg:grid-cols-[1fr_310px]">
      <div className="space-y-5">
        <section className="rounded-[24px] border border-border bg-card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#dceee2] text-primary"><UserRound size={18}/></span><div><h2 className="display text-2xl font-semibold">Личные параметры</h2><p className="text-xs text-muted-foreground">Основные данные и ориентиры</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Пол" value={form.sex} onChange={v => update('sex', v as ProfileSex)} items={[['female', 'Женский'], ['male', 'Мужской']]} testId="select-sex"/>
            <NumberField label="Возраст" value={form.age} unit="лет" min={16} max={100} onChange={v => update('age', v)} testId="input-age"/>
            <NumberField label="Рост" value={form.heightCm} unit="см" min={120} max={230} onChange={v => update('heightCm', v)} testId="input-height"/>
            <NumberField label="Вес" value={form.weightKg} unit="кг" min={30} max={250} step={0.1} onChange={v => update('weightKg', v)} testId="input-profile-weight"/>
          </div>
        </section>
        <section className="rounded-[24px] border border-border bg-card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f8e3d8] text-[#a24c32]"><Dumbbell size={18}/></span><div><h2 className="display text-2xl font-semibold">Цель и активность</h2><p className="text-xs text-muted-foreground">Настройка под реальную жизнь</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Цель" value={form.goal} onChange={v => update('goal', v as ProfileGoal)} items={[['lose', 'Снижение веса'], ['maintain', 'Поддержание'], ['gain', 'Набор массы']]} testId="select-goal"/>
            <SelectField label="Уровень тренировок" value={form.level} onChange={v => update('level', v as ProfileLevel)} items={[['beginner', 'Начальный'], ['intermediate', 'Средний'], ['advanced', 'Продвинутый']]} testId="select-level"/>
            <div className="sm:col-span-2"><SelectField label="Повседневная активность" value={String(form.activity)} onChange={v => update('activity', Number(v) as ProfileActivity)} items={[[String(1.2), 'Низкая · в основном сидя'], [String(1.375), 'Умеренная · регулярно двигаюсь'], [String(1.55), 'Высокая · активный день']]} testId="select-activity"/></div>
          </div>
        </section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button disabled={save.isPending} className="action-button rounded-xl bg-primary px-6 py-3.5 text-sm font-extrabold text-white disabled:opacity-50" data-testid="button-save-profile">{save.isPending ? 'Сохраняем…' : 'Сохранить профиль'}</button>{notice && <p role="status" className={`text-sm ${notice.startsWith('Не') ? 'text-destructive' : 'text-primary'}`} data-testid="status-profile-save">{notice}</p>}</div>
      </div>
      <aside className="space-y-4">
        <div className="rounded-[24px] bg-[#173d32] p-6 text-[#f3f0df]"><p className="mono text-[10px] uppercase tracking-[.18em] text-[#a7c3ab]">Аккаунт</p><h2 className="display mt-3 break-all text-xl font-semibold">{account.data?.email || 'Личный аккаунт'}</h2><p className="mt-3 text-xs leading-5 text-[#c0d1c4]">Ваши данные доступны после входа на любом устройстве.</p><div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-[#d0dfd2]"><Check size={14} className="text-[#e8a16d]"/>Сессия защищена личным входом</div></div>
        <div className="rounded-[24px] bg-[#e8a16d] p-6"><p className="mono text-[10px] uppercase tracking-[.18em]">Небольшая заметка</p><p className="display mt-3 text-2xl font-semibold">Не нужно быть идеальным. Нужно быть собой — регулярно.</p></div>
      </aside>
    </form>
    {!profile && <p className="text-xs text-muted-foreground">Сохраните профиль, чтобы начать вести персональные ориентиры.</p>}
  </div>;
}
function NumberField({ label, value, unit, min, max, step = 1, onChange, testId }: { label: string; value: number; unit: string; min: number; max: number; step?: number; onChange: (v: number) => void; testId: string }) {
  return <label className="block text-xs font-bold">{label}<span className="relative mt-2 block"><input type="number" required min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="h-12 w-full rounded-xl border border-border bg-background px-4 pr-14 text-sm outline-none focus:border-primary" data-testid={testId}/><span className="mono absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{unit}</span></span></label>;
}
function SelectField({ label, value, onChange, items, testId }: { label: string; value: string; onChange: (v: string) => void; items: [string, string][]; testId: string }) {
  return <label className="block text-xs font-bold">{label}<span className="relative mt-2 block"><select value={value} onChange={e => onChange(e.target.value)} className="h-12 w-full appearance-none rounded-xl border border-border bg-background px-4 pr-10 text-sm outline-none focus:border-primary" data-testid={testId}>{items.map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select><ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"/></span></label>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="my-5 rounded-2xl border border-dashed border-border bg-background/70 p-7 text-center" data-testid="state-empty"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary"><Activity size={19}/></span><h3 className="display mt-3 text-xl font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{text}</p></div>;
}

function Router({ token, setToken }: { token: string | null; setToken: (s: string | null) => void }) {
  return <Switch>
    <Route path="/login"><AuthPage onAuthenticated={setToken}/></Route>
    <Route path="/"><PrivateScreen token={token} setToken={setToken}><HomePage/></PrivateScreen></Route>
    <Route path="/week"><PrivateScreen token={token} setToken={setToken}><WeekPage/></PrivateScreen></Route>
    <Route path="/workouts"><PrivateScreen token={token} setToken={setToken}><WorkoutsPage/></PrivateScreen></Route>
    <Route path="/meals"><PrivateScreen token={token} setToken={setToken}><MealsPage/></PrivateScreen></Route>
    <Route path="/progress"><PrivateScreen token={token} setToken={setToken}><ProgressPage/></PrivateScreen></Route>
    <Route path="/profile"><PrivateScreen token={token} setToken={setToken}><ProfilePage/></PrivateScreen></Route>
    <Route component={NotFound}/>
  </Switch>;
}
function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(SESSION_KEY));
  return <QueryClientProvider client={queryClient}>
    <WouterRouter hook={useHashLocation} base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router token={token} setToken={setToken}/></WouterRouter>
  </QueryClientProvider>;
}

export default App;
