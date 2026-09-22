# Leve — Compactador de vídeos MP4

Aplicação web para compactar vídeos diretamente no navegador, com interface em português e temas claro e escuro.

**[Abrir o app](https://juliaromeira.github.io/leve-mp4/)**

## Funcionalidades

- Seleção por arquivo ou arrastar e soltar: MP4, MOV e WebM, até 500 MB.
- Três opções de qualidade: menor arquivo, equilibrada e maior qualidade.
- Resolução máxima de 480p, 720p, 1080p ou original, preservando a proporção.
- Opção de manter ou remover o áudio.
- Progresso da compactação e cancelamento.
- Prévia, comparação de tamanhos e download do MP4 final.
- Layout responsivo para computador e celular.
- Tema claro e escuro com alternância deslizante e preferência salva no navegador.

## Tecnologias

HTML5, CSS3 e JavaScript puro. A biblioteca [Mediabunny](https://mediabunny.dev/), versão 1.56.1, utiliza WebCodecs para converter o vídeo em MP4 com H.264 e, quando mantido, áudio AAC. O arquivo da biblioteca está incluído em `dist/mediabunny.js`.

Não há back-end nem banco de dados. Os vídeos são processados no dispositivo e não são enviados a um servidor. A página carrega fontes do Google Fonts.

## Executar localmente

Com Python 3 instalado, na pasta do projeto:

```bash
python -m http.server 8000 --directory dist
```

Abra `http://localhost:8000` em um navegador atualizado com suporte a WebCodecs. Use um servidor local; não abra o HTML diretamente pelo explorador de arquivos.

Para hospedar, publique a pasta `dist` em um serviço de arquivos estáticos com HTTPS. Não é necessário instalar dependências nem executar uma etapa de build.

## Estrutura

```text
dist/
  index.html       # Estrutura da interface
  style.css        # Temas claro/escuro e estilos responsivos
  favicon.svg      # Ícone da Leve na aba do navegador
  app.js           # Seleção, compactação e download
  mediabunny.js    # Biblioteca de processamento de mídia
```

## Compatibilidade e limites

O suporte depende do navegador, dos codecs do arquivo e do dispositivo. O app verifica a disponibilidade dos recursos e informa quando uma faixa de vídeo ou áudio não pode ser convertida. Arquivos já otimizados podem não diminuir de tamanho. Mantenha a aba aberta até terminar; vídeos maiores exigem mais memória e tempo.

As verificações realizadas cobrem a sintaxe, os arquivos locais e a configuração da biblioteca. A conversão completa precisa ser validada em navegadores e dispositivos reais com arquivos de teste.

## Autoria

Desenvolvido por [Júlia Romeira](https://github.com/JuliaRomeira).

Mediabunny é uma dependência de terceiros e mantém sua própria licença. Consulte o [projeto original](https://github.com/Vanilagy/mediabunny).
