# NanoSeq Demux & Variant Caller

这是一个用于纳米孔测序（Nanopore Sequencing）数据的解复用（Demultiplexing）和变异检测（Variant Calling）的 Web 应用程序。它专为处理 96 孔板格式的数据而设计，提供直观的界面来查看每个孔位的测序深度和突变情况。

## 主要功能

- **解复用 (Demultiplexing)**：根据自定义的前向（Forward）和反向（Reverse）条形码（Barcodes）将 FASTQ 原始数据分配到 96 孔板的各个孔位。
- **变异检测 (Variant Calling)**：将读取的序列与参考序列进行比对，识别非同义突变。
- **可视化孔板视图**：
  - 颜色深浅表示测序深度（Depth）。
  - 支持多种突变显示格式：
    - **A2L (Format: A2L)**：显示如 `M1V` 格式的突变。
    - **2L (Format: 2L)**：显示如 `1V` 格式的突变。
    - **Specific Pos (Format: Specific Pos)**：显示特定位点范围内的氨基酸序列。
  - **显示限制**：支持设置每个孔位显示的突变数量上限（MAX），超出部分用省略号代替。
- **数据导出**：支持导出解复用后的单个孔位 FASTQ 文件，以及全板的变异汇总 CSV 文件。
- **高性能处理**：使用 Web Workers 在后台处理繁重的计算任务，确保界面流畅。

## 技术栈

- **Frontend**: React, TypeScript, Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Processing**: Web Workers (用于处理大规模 FASTQ 数据)

## 部署与运行

### 本地开发

1. **安装依赖**:
   ```bash
   npm install
   ```

2. **启动开发服务器**:
   ```bash
   npm run dev
   ```
   访问 `http://localhost:3000` 查看应用。

### 生产环境构建

1. **构建项目**:
   ```bash
   npm run build
   ```
   构建后的文件将生成在 `dist` 目录中。

2. **预览构建结果**:
   ```bash
   npm run preview
   ```

### 启用部署

该项目是一个静态单页应用（SPA）。您可以将其部署到任何静态托管服务，如：

- **Vercel / Netlify**: 关联 GitHub 仓库，设置构建命令为 `npm run build`，输出目录为 `dist`。
- **GitHub Pages**: 使用 `gh-pages` 分支或 GitHub Actions 进行部署。
- **Docker**: 可以使用 Nginx 镜像来托管 `dist` 目录中的静态文件。

## 注意事项

- 所有的序列处理均在浏览器本地完成，数据不会上传到任何服务器，确保了数据的隐私和安全。
- 对于超大规模的 FASTQ 文件，处理速度取决于您的计算机 CPU 性能。
