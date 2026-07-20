# GraphMind AI
**Enterprise Multimodal Knowledge Graph Intelligence Platform**

GraphMind AI is a state-of-the-art multimodal Retrieval-Augmented Generation (RAG) platform. It deeply integrates graph-based data structures with advanced vector similarity search to construct an intelligent system capable of ingesting diverse data types, organizing them into a knowledge graph, and reasoning over complex relationships using Large Language Models.

---

## 🚀 Core Features & Capabilities

### 1. Multimodal Knowledge Ingestion
- **Diverse Data Sources:** Capable of processing unstructured data including PDFs, Word documents (docx), Youtube Transcripts, HTML/Web Scraping, and raw text.
- **Entity & Relationship Extraction:** Employs advanced LLMs (via LangChain & Ollama) to automatically identify named entities and contextual relationships, dynamically generating graph nodes and edges.

### 2. Streamlined Database Architecture
The platform is built for high efficiency and scalability, utilizing a focused dual-database approach for all tasks:
- **MongoDB:** Serves as the robust primary multi-tenant document store and acts as a custom `MultiTenantMongoDBGraphStore` engine, handling graph relationships, metadata, and document storage seamlessly in one place.
- **Redis:** Acts as a high-speed caching layer, Celery task broker, and ensures rapid response times across the application.

### 3. Advanced GraphRAG & Query Engine
- **Multi-Tenant Graph Traversal:** Custom-built graph store enabling UUID-resolved entity traversal across isolated user workspaces directly within MongoDB.
- **Configurable Deep Traversal:** Supports complex graph queries with configurable semantic depth (e.g., `max_depth=3`) to retrieve deeply interconnected contexts without hallucination.
- **Local LLM Support:** Fully functional with local LLMs (Ollama) such as `gpt-oss:20b`, ensuring complete data privacy and offline capabilities.

### 4. Asynchronous Task Processing
- **Celery & Redis Integration:** Utilized for robust asynchronous task queuing, offloading computationally heavy operations like chunking, embedding generation, multimodal parsing, and graph construction.

### 5. High-Performance Modern Frontend
- **Tech Stack:** Next.js 16+, React 19, Tailwind CSS, Framer Motion.
- **Interactive Graph Visualization:** Uses `@xyflow/react` and `react-graph-vis` to provide users with a stunning, interactive visual representation of their knowledge graphs.
- **State Management:** Powered by Zustand for fast, lightweight client-side state handling.

---

## 📊 Noticeable Numericals & Scale Metrics (For Resume Impact)

When summarizing for your resume, use these quantifiable metrics to demonstrate the scale and sophistication of your architecture:

- **Containerized Microservices Architecture:** Deployed and managed a scalable local environment via Docker Compose, effectively bridging **MongoDB and Redis** to handle all graph traversal, document storage, and caching needs.
- **High-Availability Data Processing:** Built a robust asynchronous data ingestion pipeline utilizing **Celery backed by Redis**, capable of processing multimodal inputs (PDFs, Web, Video Transcripts) continuously and reliably.
- **Advanced GraphRAG Querying:** Engineered a custom `MultiTenantMongoDBGraphStore` that resolves user queries by executing semantic similarity searches and traversing knowledge graphs up to **N-degrees of depth** entirely within MongoDB, significantly reducing LLM hallucinations.
- **Targeted Uptime & Performance:** Architected backend APIs via **FastAPI** designed to handle heavy analytics loads, tracking total nodes/edges with low-latency constraints and targeting **99.9% application uptime**.
- **Modern UI Rendering:** Delivered a highly responsive Next.js frontend utilizing **Zustand** and **React Graph Vis** to seamlessly render complex node-edge graph structures in real-time.

---

## 🛠️ Technology Stack Summarized

- **Backend & AI:** Python, FastAPI, LangChain, Ollama, Celery
- **Frontend:** Next.js 16, React 19, TailwindCSS, Shadcn, Framer Motion, Zustand
- **Databases:** MongoDB, Redis
- **Infrastructure & Task Queue:** Docker Compose, Redis
- **Data Parsers:** `pypdf`, `youtube-transcript-api`, `beautifulsoup4`, `unstructured`
