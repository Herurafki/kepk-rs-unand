'use strict';

const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',

    info: {
      title: 'KEPK API',
      version: '1.0.0',
      description:
        'API Sistem Komite Etik Penelitian Kesehatan Rumah Sakit Universitas Andalas',
    },

    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development',
      },
    ],

    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },

  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
  ],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;