/**
 * GraphQL API
 */

import { FastifyInstance } from 'fastify';
import mercurius from 'mercurius';
import { GraphQLConfig } from '../config';
import { DatabaseManager } from '../database/manager';

const schema = `
  type Message {
    topic: String!
    payload: JSON!
    timestamp: String!
    receivedAt: String!
  }

  type Schema {
    name: String!
    version: String!
    topicPattern: String
    fields: [Field!]!
  }

  type Field {
    name: String!
    type: String!
    required: Boolean
  }

  type Query {
    messages(
      topic: String
      startTime: String
      endTime: String
      limit: Int
    ): [Message!]!

    schemas: [Schema!]!
    schema(name: String!): Schema
  }

  scalar JSON
`;

export async function setupGraphQL(
  fastify: FastifyInstance,
  config: GraphQLConfig,
  database: DatabaseManager
) {
  await fastify.register(mercurius, {
    schema,
    resolvers: {
      Query: {
        async messages(_: any, args: any) {
          return database.query({
            topic: args.topic,
            startTime: args.startTime ? new Date(args.startTime) : undefined,
            endTime: args.endTime ? new Date(args.endTime) : undefined,
            limit: args.limit || 1000,
          });
        },
        schemas() {
          // Return empty for now
          return [];
        },
        schema(_: any, args: any) {
          return null;
        },
      },
    },
    graphiql: config.playground,
    path: config.path,
  });
}
