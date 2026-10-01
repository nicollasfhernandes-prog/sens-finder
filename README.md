# Sens Finder

App de desktop pra encontrar a sensibilidade de mouse ideal em Valorant, CS2, Apex Legends, Overwatch 2, Call of Duty, Fortnite e Rainbow Six Siege.

Ele parte do seu setup (DPI e a sens que você já usa) e ajusta pelo jeito que você mira em testes 3D: se você passa do alvo com frequência (overflick), a sens desce; se fica curto (underflick), sobe. O resultado mostra também quantos centímetros de mousepad a sens usa pra uma volta de 360°.

## Download

Baixe a versão mais recente em [Releases](https://github.com/nicollasfhernandes-prog/sens-finder/releases):

- `SensFinder-Setup-x.y.z.exe`: instalador com atalho no menu iniciar.
- `SensFinder-Portable-x.y.z.exe`: roda direto, sem instalar.

Os executáveis não têm assinatura digital. Na primeira vez, o Windows pode mostrar "O Windows protegeu o computador": clique em **Mais informações** e depois em **Executar assim mesmo**.

## O que tem

- **Sens Finder**: questionário, sens inicial convertida de outro jogo ou calculada pelo estilo de mira, e três testes curtos (Flick, Gridshot e Tracking) que ajustam o valor.
- **Treinos**: cenários inspirados no Aim Lab (Spidershot, Spidershot180, Microshot, Sixshot, Motionshot, Linetrace, Switchtrack, HeadshotReflex e Gridshot). Cada partida analisa overflick e underflick e sugere um ajuste de sens. Segure `R` pra reiniciar; `Esc` pausa.
- **Memória muscular**: cada flick é separado em impulso principal e correções. O app mede a velocidade de pico da mão (cm/s), o tempo de reação, onde o primeiro movimento parou em relação ao alvo e quantas correções vieram depois, e resume tudo num índice de 0 a 100.
- **Progresso**: histórico das partidas comparando as sens que você já usou, pra mostrar com qual sua mão está mais calibrada.
- **Configurações**: FOV do jogo, mira (estilo, cor, espessura, comprimento, espaço, ponto e contorno), cores do alvo, fundo e parede, sons de disparo e acerto, e o código de perfil de mira pra importar no Valorant.

## Como a conversão entre jogos funciona

Cada jogo gira a câmera um certo número de graus por movimento do mouse (o "yaw"). Mantendo os mesmos cm/360°, a sens de um jogo vira a de outro por `sens × yaw_origem ÷ yaw_destino`.

| Jogo | Yaw |
| --- | --- |
| Valorant | 0,07 |
| CS2 | 0,022 |
| Apex Legends | 0,022 |
| Overwatch 2 | 0,0066 |
| Call of Duty | 0,0066 |
| Fortnite (sens em %) | 0,005555 |
| Rainbow Six Siege (multiplicador 0,02) | 0,00573 |

Os valores são os usados por conversores da comunidade. O formato do código de mira do Valorant também vem de engenharia reversa da comunidade, não de uma especificação oficial da Riot.

## Desenvolvimento

Precisa de Node.js 20 ou mais recente.

```bash
npm install
npm run dev      # abre o app em modo de desenvolvimento
npm run dist     # gera o instalador e o portátil em dist/
```

Feito com Electron, React, TypeScript e three.js.
