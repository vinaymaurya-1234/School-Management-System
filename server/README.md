# School Management System API

Node.js, Express, MongoDB/Mongoose and JWT-authenticated API.

## Chat module setup

The chat module uses Socket.IO for real-time messages and MongoDB for conversations, messages and file bytes. Attachments are stored in MongoDB GridFS (the chatUploads.files and chatUploads.chunks collections); no third-party file storage credentials are needed.

1. Copy .env.example to .env and configure MONGODB_URI, JWT_SECRET, and CLIENT_URL.
2. From server/, run npm install to synchronize dependencies, then npm run dev.
3. From client/, run npm install to install socket.io-client, then npm run dev.

## Chat capabilities

- JWT-authenticated Socket.IO connections and conversation membership checks.
- Direct chats with school-contact restrictions based on roles and existing student enrollment / teacher assignment records.
- Group conversations, including custom, class, teachers and school group types.
- Text messages, unread counts, read receipts, message history and image/video/PDF uploads.
- Attachments are limited to 30 MB each and up to five per message. GridFS stores file contents in MongoDB chunks to avoid the 16 MB MongoDB document limit.
- File downloads require authentication and membership in the conversation the file belongs to.

Do not commit real credentials to Git. The feature has not been runtime-tested in this repository environment; verify it with separate accounts before production use.
