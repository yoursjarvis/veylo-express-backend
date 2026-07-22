const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
const outputPath = path.join(__dirname, "../prisma/schema.dbml");

function generateDbml() {
  console.log(`Reading Prisma schema from: ${schemaPath}`);
  const schemaContent = fs.readFileSync(schemaPath, "utf8");

  const lines = schemaContent.split("\n");
  const models = [];
  let currentModel = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith("model ")) {
      const match = line.match(/^model\s+(\w+)\s*\{/);
      if (match) {
        currentModel = {
          name: match[1],
          dbName: match[1], // default to model name
          fields: [],
          relations: [],
          compositePk: null,
          compositeUniques: [],
          indexes: [],
        };
        models.push(currentModel);
      }
    } else if (line === "}") {
      currentModel = null;
    } else if (currentModel) {
      if (line.startsWith("@@map(")) {
        const match = line.match(/@@map\("([^"]+)"\)/);
        if (match) {
          currentModel.dbName = match[1];
        }
      } else if (line.startsWith("@@id(")) {
        const match = line.match(/@@id\(\[([^\]]+)\]/);
        if (match) {
          const fields = match[1]
            .split(",")
            .map((f) => f.trim().replace(/"/g, ""));
          currentModel.compositePk = fields;
        }
      } else if (line.startsWith("@@unique(")) {
        const match = line.match(/@@unique\(\[([^\]]+)\]/);
        if (match) {
          const fields = match[1]
            .split(",")
            .map((f) => f.trim().replace(/"/g, ""));
          currentModel.compositeUniques.push(fields);
        }
      } else if (line.startsWith("@@index(")) {
        const match = line.match(/@@index\(\[([^\]]+)\]/);
        if (match) {
          const fields = match[1]
            .split(",")
            .map((f) => f.trim().replace(/"/g, ""));
          currentModel.indexes.push(fields);
        }
      } else if (
        line.startsWith("@@") ||
        line.startsWith("//") ||
        line.startsWith("/*")
      ) {
        // Skip table-level indexes/comments for field parsing
      } else {
        // Parse field definition
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const fieldName = parts[0];
          const fieldType = parts[1];
          const attributesStr = parts.slice(2).join(" ");

          currentModel.fields.push({
            name: fieldName,
            type: fieldType,
            attributesStr: attributesStr,
          });
        }
      }
    }
  }

  const modelNames = new Set(models.map((m) => m.name));

  // Helper to find DB column name for a field name on a given model
  function getColumnDbName(model, fieldName) {
    const fieldObj = model.fields.find((f) => f.name === fieldName);
    if (fieldObj) {
      const match = fieldObj.attributesStr.match(/@map\("([^"]+)"\)/);
      if (match) return match[1];
    }
    return fieldName;
  }

  // Helper to map type from Prisma to DBML
  function getDbmlType(field) {
    let type = field.type.replace("?", "").replace("[]", "");
    const attr = field.attributesStr;

    if (type === "String") {
      if (attr.includes("@db.Uuid")) return "uuid";
      if (attr.includes("@default(uuid")) return "uuid";
      const varcharMatch = attr.match(/@db\.VarChar\((\d+)\)/);
      if (varcharMatch) return `varchar(${varcharMatch[1]})`;
      if (attr.includes("@db.Text")) return "text";
      return "varchar";
    }
    if (type === "Int") return "integer";
    if (type === "BigInt") return "bigint";
    if (type === "Float") return "float";
    if (type === "Decimal") return "decimal";
    if (type === "Boolean") return "boolean";
    if (type === "DateTime") return "timestamp";
    if (type === "Json") return "json";

    return type;
  }

  // Helper to extract default value
  function getDefaultValue(attr) {
    const match = attr.match(/@default\(([^)]+)\)/);
    if (!match) return null;
    const val = match[1].trim();
    if (val === "now()") {
      return "`now()`";
    }
    if (val.startsWith('"') && val.endsWith('"')) {
      const strVal = val.slice(1, -1);
      return `'${strVal}'`;
    }
    if (val === "true" || val === "false") {
      return val;
    }
    if (!isNaN(val)) {
      return val;
    }
    return `\`${val}\``;
  }

  // Output buffer
  let dbml = `// DBML generated from Prisma Schema\n// Visualization code for dbdiagram.io\n\n`;

  // Write Tables
  for (const model of models) {
    dbml += `Table ${model.dbName} {\n`;

    // Add columns
    const columns = [];
    for (const field of model.fields) {
      const isRelation = modelNames.has(
        field.type.replace("?", "").replace("[]", ""),
      );
      if (isRelation) continue; // Skip virtual relation fields

      const dbColName = getColumnDbName(model, field.name);
      const dbType = getDbmlType(field);

      const settings = [];
      const isPk = field.attributesStr.includes("@id") && !model.compositePk;
      if (isPk) {
        settings.push("pk");
      }
      if (field.attributesStr.includes("@unique")) {
        settings.push("unique");
      }

      const defaultVal = getDefaultValue(field.attributesStr);
      if (defaultVal !== null) {
        settings.push(`default: ${defaultVal}`);
      }

      const isNullable = field.type.endsWith("?");
      if (!isNullable) {
        settings.push("not null");
      }

      const noteParts = [];
      if (field.name !== dbColName) {
        noteParts.push(`prisma: ${field.name}`);
      }
      if (noteParts.length > 0) {
        settings.push(`note: '${noteParts.join(", ")}'`);
      }

      const settingsStr =
        settings.length > 0 ? ` [${settings.join(", ")}]` : "";
      columns.push(`  ${dbColName} ${dbType}${settingsStr}`);
    }
    dbml += columns.join("\n") + "\n";

    // Add indexes (including composite PKs / uniques)
    const indexLines = [];
    if (model.compositePk) {
      const pkCols = model.compositePk
        .map((f) => getColumnDbName(model, f))
        .join(", ");
      indexLines.push(`    (${pkCols}) [pk]`);
    }
    for (const uniqueGroup of model.compositeUniques) {
      const uniqueCols = uniqueGroup
        .map((f) => getColumnDbName(model, f))
        .join(", ");
      indexLines.push(`    (${uniqueCols}) [unique]`);
    }
    for (const indexGroup of model.indexes) {
      const indexCols = indexGroup
        .map((f) => getColumnDbName(model, f))
        .join(", ");
      indexLines.push(`    (${indexCols})`);
    }

    if (indexLines.length > 0) {
      dbml += `\n  indexes {\n${indexLines.join("\n")}\n  }\n`;
    }

    dbml += `}\n\n`;
  }

  // Parse and generate relations
  const allRelations = [];
  for (const model of models) {
    for (const field of model.fields) {
      const targetModelName = field.type.replace("?", "").replace("[]", "");
      const isRelation = modelNames.has(targetModelName);
      if (!isRelation) continue;

      if (field.attributesStr.includes("@relation")) {
        const relationAttr = field.attributesStr;
        const fieldsMatch = relationAttr.match(/fields:\s*\[([^\]]+)\]/);
        const referencesMatch = relationAttr.match(
          /references:\s*\[([^\]]+)\]/,
        );

        if (fieldsMatch && referencesMatch) {
          const fkFields = fieldsMatch[1].split(",").map((f) => f.trim());
          const pkFields = referencesMatch[1].split(",").map((f) => f.trim());

          let onDelete = null;
          const deleteMatch = relationAttr.match(/onDelete:\s*(\w+)/);
          if (deleteMatch) {
            onDelete = deleteMatch[1].toLowerCase();
            if (onDelete === "setnull") onDelete = "set null";
            if (onDelete === "noaction") onDelete = "no action";
          }

          const targetModel = models.find((m) => m.name === targetModelName);
          if (targetModel) {
            for (let i = 0; i < fkFields.length; i++) {
              const fkField = fkFields[i];
              const pkField = pkFields[i];

              const fkDbName = getColumnDbName(model, fkField);
              const pkDbName = getColumnDbName(targetModel, pkField);

              const fkFieldObj = model.fields.find((f) => f.name === fkField);
              const isOneToOne =
                fkFieldObj &&
                (fkFieldObj.attributesStr.includes("@unique") ||
                  fkFieldObj.attributesStr.includes("@id"));
              const relSymbol = isOneToOne ? "-" : ">";

              let refSettings = "";
              if (onDelete) {
                refSettings = ` [delete: ${onDelete}]`;
              }

              allRelations.push(
                `Ref: ${model.dbName}.${fkDbName} ${relSymbol} ${targetModel.dbName}.${pkDbName}${refSettings}`,
              );
            }
          }
        }
      }
    }
  }

  dbml += allRelations.join("\n") + "\n";

  fs.writeFileSync(outputPath, dbml);
  console.log(`Successfully generated DBML file at: ${outputPath}`);
}

generateDbml();
