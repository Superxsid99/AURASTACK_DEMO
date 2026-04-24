import { GoogleGenAI, Type, GenerateContentResponse, FunctionDeclaration } from "@google/genai";
import { WorkflowDefinition } from "../types/workflow";
import { AgentDefinition } from "../types/agent";
import { Case } from "../types/case";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Define common insurance tools for agents
const insuranceTools: FunctionDeclaration[] = [
  {
    name: "search_policy_db",
    description: "Search the internal policy database for policy details, coverage, and history.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        policy_number: { type: Type.STRING, description: "The unique policy identifier" },
        include_claims: { type: Type.BOOLEAN, description: "Whether to include claim history" }
      },
      required: ["policy_number"]
    }
  },
  {
    name: "validate_medical_codes",
    description: "Validate ICD-10 or CPT codes against standard medical coding databases.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        codes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of medical codes to validate" }
      },
      required: ["codes"]
    }
  },
  {
    name: "calculate_risk_score",
    description: "Calculate a risk score based on patient demographics and medical history.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        patient_id: { type: Type.STRING },
        factors: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Specific risk factors to consider" }
      },
      required: ["patient_id"]
    }
  }
];

// Mock tool implementations
const toolImplementations: Record<string, (args: any) => any> = {
  search_policy_db: (args) => ({
    policy_id: args.policy_number,
    status: 'ACTIVE',
    coverage_limit: 1000000,
    deductible: 5000,
    holder: 'John Doe',
    claims: args.include_claims ? [{ id: 'C-123', status: 'PAID', amount: 1200 }] : []
  }),
  validate_medical_codes: (args) => ({
    valid: true,
    validated_codes: args.codes.map((c: string) => ({ code: c, description: 'Validated Medical Procedure' }))
  }),
  calculate_risk_score: (args) => ({
    risk_score: 0.24,
    level: 'LOW',
    factors_analyzed: args.factors?.length || 0
  })
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES, backoff = INITIAL_BACKOFF): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED";
    
    if (isRateLimit && retries > 0) {
      console.warn(`AI Service: Rate limit hit. Retrying in ${backoff}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return withRetry(fn, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export const aiService = {
  async generateResponse(prompt: string, context: any, tools: any[]) {
    const model = "gemini-3.1-pro-preview";
    
    const systemInstruction = `
      You are the Aurastack AI OS Intelligence Layer. 
      Your goal is to help users manage their operational workflows, agents, and cases.
      You can build workflows, create agents, update cases, and generate reports.
      
      Current Context:
      ${JSON.stringify(context, null, 2)}
      
      When a user asks to "build" or "create" something, use the provided tools.
      If they ask for insights on the current screen, analyze the context and provide strategic advice.
      Be concise, professional, and technical.
    `;

    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: tools }],
        },
      });
      return response;
    });
  },

  async getInsights(context: any) {
    const model = "gemini-3.1-pro-preview";
    
    const systemInstruction = `
      You are the Aurastack AI OS Intelligence Layer. 
      Analyze the current application context and provide real-time insights.
      
      Current Context:
      ${JSON.stringify(context, null, 2)}
      
      Return a JSON object with the following structure:
      {
        "summaries": ["string", "string"],
        "tips": ["string", "string"],
        "prediction": { "text": "string", "type": "info | warning | critical" },
        "alerts": [
          { "title": "string", "desc": "string", "type": "error | warning | info" }
        ],
        "logs": [
          { "timestamp": "HH:mm:ss", "message": "string", "type": "secondary | error | info" }
        ]
      }
      
      Be concise, technical, and highly relevant to the current screen and data.
    `;

    try {
      const response = await withRetry(async () => {
        return await ai.models.generateContent({
          model,
          contents: "Generate real-time insights for the current context.",
          config: {
            systemInstruction,
            responseMimeType: "application/json",
          },
        });
      });

      return JSON.parse(response.text || "{}");
    } catch (error: any) {
      console.error("AI Insights Error:", error);
      // Return a structured error object if it's a quota issue
      if (error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED") {
        return { error: "QUOTA_EXCEEDED" };
      }
      return null;
    }
  },

  async executeAgent(agent: AgentDefinition, targetCase: Case, input: any): Promise<any> {
    const model = "gemini-3.1-pro-preview";
    
    const systemInstruction = `
      You are an autonomous AI Agent: ${agent.name} (${agent.agent_id}).
      Role: ${agent.description}
      
      Your Instructions:
      ${agent.instructions}
      
      Your Constraints:
      ${agent.constraints.join("\n")}
      
      Input Schema:
      ${JSON.stringify(agent.input_schema, null, 2)}
      
      Output Schema:
      ${JSON.stringify(agent.output_schema, null, 2)}
      
      Current Case Context:
      ${JSON.stringify({
        id: targetCase.id,
        type: targetCase.type,
        metadata: targetCase.metadata,
        documents: targetCase.documents?.map(d => ({ name: d.name, type: d.type, status: d.status }))
      }, null, 2)}
      
      You MUST return a JSON object that strictly follows the output schema.
      Do not include any preamble or explanation. Just the JSON.
      
      If you need to use tools to gather more information, use them.
    `;

    const prompt = `
      Execute task with the following input:
      ${JSON.stringify(input, null, 2)}
    `;

    try {
      const response = await withRetry(async () => {
        return await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            tools: [{ functionDeclarations: insuranceTools }],
          },
        });
      });

      // Handle function calls if any
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        const toolResponses = functionCalls.map(fc => {
          const implementation = toolImplementations[fc.name];
          if (implementation) {
            return {
              name: fc.name,
              id: fc.id,
              response: implementation(fc.args)
            };
          }
          return { name: fc.name, id: fc.id, response: { error: "Tool not found" } };
        });

        // Send tool responses back to the model for final answer
        const finalResponse = await withRetry(async () => {
          return await ai.models.generateContent({
            model,
            contents: [
              { role: 'user', parts: [{ text: prompt }] },
              { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] },
              { role: 'user', parts: toolResponses.map(tr => ({ functionResponse: tr })) }
            ],
            config: {
              systemInstruction,
              responseMimeType: "application/json",
            },
          });
        });

        const result = JSON.parse(finalResponse.text || "{}");
        return {
          status: 'success',
          data: result,
          confidence: 0.98,
          timestamp: new Date().toISOString(),
          tools_used: functionCalls.map(fc => fc.name)
        };
      }

      const result = JSON.parse(response.text || "{}");
      return {
        status: 'success',
        data: result,
        confidence: 0.98,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error(`Agent ${agent.agent_id} Execution Error:`, error);
      throw error;
    }
  }
};
