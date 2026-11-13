'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AnalysisWorkspace from '../workspace';
import edital from '../../demo/edital.json';
import { ensureDemoFetch, holdDemoFetch } from './mock-api';

/** Análise de editais para o pitch: mesmos componentes da versão real, com a API simulada no navegador. */
export default function DemoAnalise() {
  // Instala antes do primeiro render dos filhos (os efeitos dos filhos rodam antes dos do pai).
  useState(ensureDemoFetch);
  useEffect(holdDemoFetch, []);
  return <>
    <p className="notice">Demonstração com edital fictício ({edital.pregao}, {edital.orgao}). A leitura da IA é simulada no navegador e nada é enviado ao servidor. Recarregue a página para recomeçar. Para editais reais, use <Link href="/analise/documentos">Análise com dados reais</Link>.</p>
    <AnalysisWorkspace fileUrl={() => edital.pdf} />
  </>;
}
