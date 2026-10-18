# School Management System API

Node.js, Express, MongoDB/Mongoose and JWT-authenticated API.

## Chat module setup

The chat module uses Socket.IO for real-time events and MongoDB for conversations/messages. File uploads use Cloudinary so media files are not stored in MongoDB.

1. Copy `.env.example` to `.env` and configure `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL`.
2. For image, video and PDF uploads, create a free Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Without these credentials, text messaging works but uploads return a clear configuration error.
3. From `server/`, run `npm install` to install the new Socket.IO, Multer and Cloudinary dependencies, then `npm run dev`.
4. From `client/`, run `npm install` to install `socket.io-client`, then `npm run dev`.

## Chat capabilities

- JWT-authenticated Socket.IO connections and conversation membership checks.
- Direct chats with school-contact restrictions based on roles and existing student enrollment / teacher assignment records.
- Group conversations, including custom, class, teachers and school group types.
- Text messages, unread counts, read receipts, message history and uploads for supported images, videos and PDF files.
- Attachments are limited to 30 MB each and up to five per message.

Cloudinary and hosting have free-tier quotas and may impose limits. Do not commit real credentials to Git. The feature has not been runtime-tested in this repository environment; verify it with separate accounts before production use.
