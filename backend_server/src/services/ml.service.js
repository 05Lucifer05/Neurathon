/**
 * ML Service Client
 * Handles communication with the Python FastAPI ML microservice
 */
const axios = require('axios');
const logger = require('../utils/logger');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';

/**
 * ML Service client
 */
class MLService {
    constructor() {
        this.client = axios.create({
            baseURL: ML_SERVICE_URL,
            timeout: 60000, // 60 second timeout for batch processing
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Health check for ML service
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return response.data;
        } catch (error) {
            logger.error(`ML Service health check failed: ${error.message}`);
            throw new Error('ML Service is unavailable');
        }
    }

    /**
     * Detect fraud for batch of accounts
     * @param {Array} accounts - Array of account data objects
     * @returns {Object} Detection results
     */
    async detectBatch(accounts) {
        try {
            logger.info(`Sending ${accounts.length} accounts to ML service`);

            const response = await this.client.post('/api/v1/detect', {
                accounts
            });

            logger.info(`ML service returned ${response.data.processed} results`);

            return response.data;

        } catch (error) {
            if (error.response) {
                logger.error(`ML Service error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
                throw new Error(error.response.data.detail || 'ML Service processing failed');
            }

            logger.error(`ML Service connection error: ${error.message}`);
            throw new Error('Failed to connect to ML Service');
        }
    }

    /**
     * Detect fraud for single account
     * @param {Object} account - Account data object
     * @returns {Object} Detection result
     */
    async detectSingle(account) {
        try {
            const response = await this.client.post('/api/v1/detect/single', account);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(error.response.data.detail || 'ML Service processing failed');
            }
            throw new Error('Failed to connect to ML Service');
        }
    }

    /**
     * Get model information
     */
    async getModelInfo() {
        try {
            const response = await this.client.get('/api/v1/model/info');
            return response.data;
        } catch (error) {
            logger.error(`Failed to get model info: ${error.message}`);
            throw new Error('Failed to retrieve model information');
        }
    }
}

module.exports = new MLService();
