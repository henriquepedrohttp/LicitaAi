import DemoElegibilidade from './demo/demo';
import './elegibilidade.css';

export default function ElegibilidadePage() {
  return <div className="elegibilidade">
    <h1>Matriz de Elegibilidade</h1>
    <p>Compare os requisitos do edital com as evidências da empresa. O resultado é preliminar e não declara habilitação jurídica: a conclusão é sempre humana.</p>
    <DemoElegibilidade />
  </div>;
}
