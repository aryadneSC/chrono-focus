# Chrono Focus

O Chrono Focus ajuda estudantes a transformar a rotina, as matérias e os prazos em um plano de estudo. A versão web está em beta.

Informe seus dias e tempo disponível, cadastre matérias e assuntos e revise o plano. O Chrono Focus monta um cronograma de 30 dias e distribui o tempo entre as matérias conforme a urgência, a importância e a dificuldade. Na aba Hoje, escolha um assunto e use o timer Pomodoro para acompanhar o tempo efetivo de foco, anotar a retomada e marcar conclusões.

O plano e os registros ficam em memória durante o uso. Ao recarregar a página, você começa um novo plano.

## Executar localmente

Na raiz do repositório, execute `python3 -m http.server 8000 --directory public` e acesse `http://localhost:8000`.

Para rodar os testes de cronograma e timer, execute `npm test` com Node.js 22 ou posterior.
