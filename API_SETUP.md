# API Setup Documentation

This application uses the Gemini Live Multimodal API to provide real-time voice interaction. To use your own API key or configure the backend, follow these steps:

## 1. Gemini API Key
The application requires a `GEMINI_API_KEY` environment variable. 
- If running locally, create a `.env` file and add:
  ```env
  GEMINI_API_KEY="your_api_key_here"
  ```

## 2. Backend API (Express)
The application includes an Express server (`server.ts`) that handles calendar events using SQLite.
- **GET `/api/events`**: Returns all scheduled events.
- **POST `/api/events`**: Adds a new event.
- **DELETE `/api/events/:id`**: Removes an event.
- **PATCH `/api/events/:id/notified`**: Marks an event as notified.

## 3. Customizing the AI Assistant
You can modify the assistant's behavior in `src/hooks/useLiveAPI.ts` by editing the `systemInstruction` and `tools` configuration:
- **System Instruction**: Defines the AI's personality and knowledge.
- **Tools**: Defines the functions the AI can call (e.g., `add_calendar_event`, `list_calendar_events`).

## 4. Deployment
The app is configured for full-stack deployment. Ensure your environment supports Node.js and can persist the `calendar.db` SQLite file.
