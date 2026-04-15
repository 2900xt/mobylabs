FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      git \
      jq \
      curl \
      ca-certificates \
      build-essential && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 20 (needed for Claude Code)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && \
    apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Install Python ML stack
RUN pip install --no-cache-dir \
    torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir \
    scikit-learn \
    pandas \
    numpy \
    scipy \
    matplotlib \
    seaborn \
    transformers \
    datasets \
    accelerate \
    jupyter \
    nbformat \
    pytest \
    requests \
    httpx

# Create non-root user
RUN useradd --create-home --shell /bin/bash agent

# Create workspace
RUN mkdir -p /workspace && chown agent:agent /workspace

# Copy entrypoint and CLAUDE.md
COPY entrypoint.sh /entrypoint.sh
COPY CLAUDE.md /home/agent/.claude/CLAUDE.md
RUN chmod +x /entrypoint.sh && \
    mkdir -p /home/agent/.claude && \
    chown -R agent:agent /home/agent

USER agent
WORKDIR /workspace

ENTRYPOINT ["/entrypoint.sh"]
