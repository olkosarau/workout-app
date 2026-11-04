import { Link } from 'wouter';
import { ArrowLeft, CircleAlert } from 'lucide-react';

export default function NotFound() {
  return <main className="grain grid min-h-[100dvh] place-items-center bg-background p-6">
    <section className="w-full max-w-lg rounded-[28px] border border-border bg-card p-8 sm:p-12">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f8e3d8] text-[#a24c32]"><CircleAlert size={22}/></div>
      <p className="mono mt-8 text-[10px] uppercase tracking-[.2em] text-primary">Ошибка маршрута · 404</p>
      <h1 className="display mt-3 text-5xl font-semibold">Такой страницы<br/>пока нет.</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">Похоже, ссылка устарела. Вернитесь в свой журнал и продолжайте с нужного места.</p>
      <Link href="/" className="action-button mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white" data-testid="link-not-found-home"><ArrowLeft size={15}/>На главную</Link>
    </section>
  </main>;
}
