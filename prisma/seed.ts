import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Semente do estado inicial do projeto, refletindo o 01_MEMORIA (Fase 0).
// Datas de dependência ficam no passado de propósito, para o aging aparecer.
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  // Idempotente: limpa e recria.
  await prisma.$transaction([
    prisma.stateVersion.deleteMany(),
    prisma.stackItem.deleteMany(),
    prisma.dependency.deleteMany(),
    prisma.decision.deleteMany(),
    prisma.risk.deleteMany(),
    prisma.phaseStatus.deleteMany(),
    prisma.stakeholder.deleteMany(),
    prisma.baselineMetric.deleteMany(),
  ]);

  await prisma.stackItem.createMany({
    data: [
      { item: "Plataforma do Data Lake", statusVerdade: "lacuna", ordem: 1 },
      { item: "Engine de consulta / dialeto SQL", statusVerdade: "lacuna", ordem: 2 },
      { item: "Formato de armazenamento", statusVerdade: "lacuna", ordem: 3 },
      { item: "Estratégia de particionamento", statusVerdade: "lacuna", ordem: 4 },
      { item: "Ferramenta de catálogo existente", statusVerdade: "lacuna", ordem: 5 },
      { item: "Portal escolhido", statusVerdade: "lacuna", ordem: 6 },
      { item: "BI / ferramenta de consumo", statusVerdade: "lacuna", ordem: 7 },
      { item: "Como medir uso (baseline)", statusVerdade: "lacuna", ordem: 8 },
    ],
  });

  await prisma.dependency.createMany({
    data: [
      {
        codigo: "D1",
        descricao: "Acesso ao Data Lake para a equipe",
        solicitadoEm: daysAgo(7),
        status: "aguardando",
        trilhoParalelo: "Montar estrutura do dicionário com placeholders",
        ordem: 1,
      },
      {
        codigo: "D2",
        descricao: "Lista priorizada de tabelas",
        solicitadoEm: daysAgo(3),
        status: "aguardando",
        trilhoParalelo: "Definir critério de priorização e template",
        ordem: 2,
      },
      {
        codigo: "D3",
        descricao: "Nomes dos owners por domínio",
        solicitadoEm: daysAgo(1),
        status: "aguardando",
        trilhoParalelo: "Rascunhar matriz de domínios candidatos",
        ordem: 3,
      },
    ],
  });

  await prisma.risk.createMany({
    data: [
      { codigo: "R1", descricao: "Fricção do cliente atrasa acessos", severidade: "Alta", mitigacao: "Trilho paralelo + escalonamento quinzenal" },
      { codigo: "R2", descricao: "Stack desconhecido trava Fase 3", severidade: "Alta", mitigacao: "Discovery na Semana 1" },
      { codigo: "R3", descricao: "Documentação sem ownership apodrece", severidade: "Média", mitigacao: "Operating model na Fase 6" },
    ],
  });

  await prisma.phaseStatus.createMany({
    data: [
      { fase: "Fase 0 — Mobilização & Discovery", rag: "amarelo", pct: 0, comentario: "Em andamento", ordem: 0 },
      { fase: "Fase 1 — Base de Conhecimento", rag: "cinza", pct: 0, ordem: 1 },
      { fase: "Fase 2 — Governança & Metadados", rag: "cinza", pct: 0, ordem: 2 },
      { fase: "Fase 3 — Boas Práticas & Performance", rag: "cinza", pct: 0, comentario: "Bloqueada por stack", ordem: 3 },
      { fase: "Fase 4 — Capacitação & Aculturamento", rag: "cinza", pct: 0, ordem: 4 },
      { fase: "Fase 5 — Adoção & Evolução", rag: "cinza", pct: 0, ordem: 5 },
      { fase: "Fase 6 — Consolidação & Sustentação", rag: "cinza", pct: 0, ordem: 6 },
    ],
  });

  await prisma.stakeholder.createMany({
    data: [
      { papel: "Sponsor", lado: "LM", responsabilidade: "Aprova escopo, destrava acessos", ordem: 0 },
      { papel: "Analista de GOV", lado: "Blite", responsabilidade: "Documentação, governança", ordem: 1 },
      { nome: "Priscila", papel: "Ponto focal (Gerente da Área)", lado: "LM", responsabilidade: "Destrava informações/acessos", ordem: 2 },
      { papel: "Eng. de dados / plataforma", lado: "LM", responsabilidade: "Acessos, info de stack", ordem: 3 },
    ],
  });

  await prisma.baselineMetric.createMany({
    data: [
      { metrica: "Nº de usuários ativos no Data Lake", ordem: 0 },
      { metrica: "Volume de queries / semana", ordem: 1 },
      { metrica: "Nº de tickets/dúvidas de dados", ordem: 2 },
      { metrica: "Tabelas documentadas", valorInicial: "0", atual: "0", ordem: 3 },
    ],
  });

  console.log("Seed concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
