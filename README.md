Dashboard Web — Front-end

Interface web para visualizar dados analíticos do projeto dashboard-api.
Este front consome o endpoint GET /dashboard do backend e exibe os resultados em gráficos (pizza, barras, linhas), além de KPIs (Total, Média, Máximo, Mínimo) e filtros por período.

O que é

Objetivo: mostrar, de forma simples e visual, métricas retornadas pelo backend em diferentes tipos de gráfico.

Como funciona: o usuário escolhe o tipo de gráfico e o intervalo de datas; o front chama GET /dashboard?tipoGrafico=...&dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD; a resposta é renderizada com Chart.js e os KPIs são calculados no cliente.

Tecnologias

Angular 18 (standalone) — componentes sem AppModule, Reactive Forms e Signals.

Angular Material — datepicker, select e inputs.

Chart.js 4 — gráficos renderizados diretamente (sem ng2-charts).

SCSS — tema escuro com gradientes e painel translúcido para filtros.

Principais decisões

Chart.js puro para evitar o erro de binding em <canvas> e ter controle total de estilos.

Datas ISO (YYYY-MM-DD): o front converte o valor do datepicker antes de enviar.

UI focada em legibilidade: filtros em painel translúcido, cores com alto contraste, skeleton durante carregamento.

Integração com a API

Endpoint: GET /dashboard

Query params:

tipoGrafico: pie | bar | line

dataInicio: YYYY-MM-DD

dataFim: YYYY-MM-DD

Resposta esperada:

{ "type": "line", "labels": ["A","B"], "data": [100,200] }


ou

{ "message": "Nenhum dado para o período." }

Estrutura (resumo)
src/
├─ app/
│  ├─ app.config.ts
│  ├─ app.routes.ts
│  ├─ features/dashboard/
│  │  ├─ dashboard.component.{ts,html,scss}
│  └─ shared/
│     ├─ api/dashboard.service.ts
│     └─ models/chart-response.ts
└─ environments/environment.ts

Execução (dev)

Configure o backend em http://localhost:3000.

No front:

npm install
npm start


(Se necessário) crie src/environments/environment.ts:

export const environment = { api: 'http://localhost:3000' };
