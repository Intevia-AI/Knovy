# Intevia AI Architecture Diagrams

> [!IMPORTANT]
> This document is AI generated. Please verify the information before using it.

This directory contains comprehensive architecture diagrams for all components of the Intevia AI system. These diagrams provide visual representations of the system architecture, data flow, and component interactions.

## Available Diagrams

### 1. [Electron App Architecture](./electron-app-architecture.md)
- **Overall Architecture**: Main process, renderer process, and external service interactions
- **Component Flow**: Sequence diagram showing user interaction flow
- **Key Components**: Detailed breakdown of React components and hooks
- **IPC Communication**: Inter-process communication patterns

**Key Features Illustrated:**
- Electron main/renderer process separation
- IPC communication patterns
- System integration (screen capture, audio, file system)
- React component hierarchy
- Custom hooks architecture

### 2. [Web Application Architecture](./web-app-architecture.md)
- **Overall Architecture**: Client-side, server-side, and external service integration
- **Demo Interface Flow**: Real-time audio processing workflow
- **Component Structure**: Landing page and demo components
- **API Routes**: Backend API architecture and processing pipeline

**Key Features Illustrated:**
- Next.js App Router structure
- Real-time audio processing pipeline
- Browser API integration
- Server-side API endpoints
- External service connections

### 3. [Proxy Server Architecture](./proxy-server-architecture.md)
- **Overall Architecture**: WebSocket server core and connection management
- **Communication Flow**: Client-proxy-Gemini AI interaction patterns
- **Client Management**: Connection lifecycle and state management
- **Message Processing**: Real-time message routing and processing

**Key Features Illustrated:**
- WebSocket server architecture
- Rate limiting and security measures
- Client connection management
- Gemini AI integration
- Docker deployment structure

### 4. [System Integration](./system-integration.md)
- **Complete System**: End-to-end system architecture
- **Data Flow**: Audio processing and AI interaction pipeline
- **Deployment Architecture**: Development and production environments
- **Security & Authentication**: OAuth flow and security considerations

**Key Features Illustrated:**
- Multi-application integration
- Production deployment topology
- Security and authentication flows
- Performance and scaling considerations

## Diagram Types Used

### Mermaid Diagram Formats
- **Graph TB/LR**: Top-bottom and left-right flowcharts for architecture overviews
- **Sequence Diagrams**: Time-based interaction flows
- **Flowcharts**: Process and data flow representations
- **Class Diagrams**: Component relationships and hierarchies

### Color Coding Convention
- **Blue (#e1f5fe, #e3f2fd)**: Core application components
- **Purple (#f3e5f5, #fce4ec)**: UI and frontend components  
- **Green (#e8f5e8, #f1f8e9)**: External services and APIs
- **Orange (#fff3e0)**: AI and processing services
- **Red (#ffebee)**: Security and performance concerns

## How to Use These Diagrams

### For Developers
1. **New Team Members**: Start with the System Integration diagram for overall understanding
2. **Frontend Development**: Focus on Electron App and Web App architecture diagrams
3. **Backend Development**: Study the Proxy Server architecture and API flows
4. **Debugging**: Use sequence diagrams to understand interaction patterns

### For System Architects
1. **System Design**: Reference the complete system architecture
2. **Scaling Decisions**: Review performance and scaling considerations
3. **Security Planning**: Study authentication and security flows
4. **Deployment Planning**: Use deployment architecture diagrams

### For DevOps Engineers
1. **Container Deployment**: Focus on Docker deployment sections
2. **Infrastructure Setup**: Reference production environment diagrams
3. **Monitoring Setup**: Use performance metrics and monitoring flows
4. **Security Implementation**: Follow security architecture patterns

## Updating Diagrams

When making changes to the system architecture:

1. **Update Relevant Diagrams**: Modify diagrams that are affected by your changes
2. **Maintain Consistency**: Ensure color coding and naming conventions remain consistent
3. **Add New Diagrams**: Create new diagrams for significant new features or components
4. **Version Control**: Include diagram updates in your pull requests

## Tools and Resources

### Mermaid Documentation
- [Mermaid Official Documentation](https://mermaid-js.github.io/mermaid/)
- [Mermaid Live Editor](https://mermaid.live/) - For testing and editing diagrams
- [GitHub Mermaid Support](https://github.blog/2022-02-14-include-diagrams-markdown-files-mermaid/) - Native GitHub rendering

### Recommended Editors
- **VS Code**: Mermaid Preview extension
- **IntelliJ/WebStorm**: Mermaid plugin
- **Online**: Mermaid Live Editor for quick edits

## Contributing

When contributing new diagrams or updates:

1. Follow the established color coding and naming conventions
2. Include descriptive titles and legends where appropriate
3. Test diagrams in the Mermaid Live Editor before committing
4. Update this README when adding new diagram files
5. Ensure diagrams are readable at different zoom levels

## Related Documentation

- [Main Project README](../../README.md)
- [Architecture Overview](../architecture/overview.md)
- [Development Setup](../setup/development.md)
- [API Reference](../architecture/api-reference.md)