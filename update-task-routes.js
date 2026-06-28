const fs = require('fs');
const path = '/home/codeclouds-tanmoy/Personal/Veylo/veylo-express-backend/src/routes/v1/task.routes.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace('taskRoutes.use(requireAuth);\n', '');

const methods = ['get', 'post', 'patch', 'delete'];
methods.forEach(method => {
  const regex = new RegExp(`taskRoutes\\.${method}\\(("[^"]+"),\\s*([a-zA-Z0-9_]+\\.[a-zA-Z0-9_]+)\\);`, 'g');
  content = content.replace(regex, `taskRoutes.${method}($1, requireAuth, $2);`);
  
  // For routes with upload.single
  const regexUpload = new RegExp(`taskRoutes\\.${method}\\(("[^"]+"),\\s*(upload\\.single\\("[^"]+"\\)),\\s*([a-zA-Z0-9_]+\\.[a-zA-Z0-9_]+)\\);`, 'g');
  content = content.replace(regexUpload, `taskRoutes.${method}($1, requireAuth, $2, $3);`);
});

fs.writeFileSync(path, content);
