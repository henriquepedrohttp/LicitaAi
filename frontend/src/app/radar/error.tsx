"use client";
import Link from "next/link";
export default function ErrorState({ reset }: { reset: () => void }) { return <section className="card" role="alert"><h2>Não foi possível carregar o Radar</h2><p>Tente novamente para recuperar a consulta.</p><button onClick={reset}>Tentar novamente</button><p><Link href="/radar">Abrir nova pesquisa</Link></p></section>; }
