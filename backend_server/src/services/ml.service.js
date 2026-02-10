/**
 * ML Service Client
 * Handles communication with the Python FastAPI ML microservice
 * Extended with predict, train, chunked processing, and fallback support
 */
const axios = require('axios');
const logger = require('../utils/logger');
const featureEngineering = require('./featureEngineering');
const ruleBasedScoring = require('./ruleBasedScoring');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8001';
const ML_BATCH_SIZE = parseInt(process.env.ML_BATCH_SIZE) || 500;
const ML_FALLBACK_ENABLED = process.env.ML_FALLBACK_ENABLED !== 'false';

/**
 * ML Service client with extended capabilities
 */
class MLService {
    constructor() {
        this.client = axios.create({
            baseURL: ML_SERVICE_URL,
            timeout: 120000, // 120 second timeout for large batches
            headers: {
                'Content-Type': 'application/json'
            }
        });
        this.isAvailable = null;
        this.lastHealthCheck = null;
    }

    /**
     * Health check for ML service with caching
     */
    async healthCheck(force = false) {
        // Cache health check for 30 seconds
        if (!force && this.lastHealthCheck && Date.now() - this.lastHealthCheck < 30000) {
            return { status: this.isAvailable ? 'healthy' : 'unavailable' };
        }

        try {
            const response = await this.client.get('/health', { timeout: 5000 });
            this.isAvailable = true;
            this.lastHealthCheck = Date.now();
            return response.data;
        } catch (error) {
            logger.error(`ML Service health check failed: ${error.message}`);
            this.isAvailable = false;
            this.lastHealthCheck = Date.now();
            throw new Error('ML Service is unavailable');
        }
    }

    /**
     * Check if ML service is available (non-throwing)
     */
    async checkAvailability() {
        try {
            await this.healthCheck();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Detect fraud for batch of accounts (legacy endpoint)
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

    // ==================== NEW EXTENDED METHODS ==================== //

    /**
     * Predict using optimized /predict endpoint (single account)
     * @param {Object} account - Account data to predict
     * @returns {Object} Prediction result with trust_score, probability, classification
     */
    async predict(account) {
        const available = await this.checkAvailability();

        if (!available && ML_FALLBACK_ENABLED) {
            logger.warn('ML service unavailable, using rule-based scoring');
            return ruleBasedScoring.scoreAccount(account);
        }

        try {
            const preparedAccount = featureEngineering.prepareForPrediction([account])[0];
            const response = await this.client.post('/api/v1/predict', preparedAccount);
            return this._transformPredictResponse(response.data, account);
        } catch (error) {
            if (ML_FALLBACK_ENABLED) {
                logger.warn(`ML predict failed, falling back to rules: ${error.message}`);
                return ruleBasedScoring.scoreAccount(account);
            }
            throw error;
        }
    }

    /**
     * Batch predict using optimized /predict/batch endpoint
     * Supports chunked processing for large batches
     * @param {Array} accounts - Array of account data
     * @returns {Object} Batch prediction results
     */
    async predictBatch(accounts) {
        const available = await this.checkAvailability();

        if (!available && ML_FALLBACK_ENABLED) {
            logger.warn('ML service unavailable, using rule-based scoring for batch');
            return ruleBasedScoring.scoreBatch(accounts);
        }

        // DETERMINISM: Sort accounts by account_id before processing
        const sortedAccounts = [...accounts].sort((a, b) =>
            (a.account_id || '').localeCompare(b.account_id || '')
        );

        // For large batches, use chunked processing
        if (sortedAccounts.length > ML_BATCH_SIZE) {
            return await this._predictBatchChunked(sortedAccounts);
        }

        try {
            const preparedAccounts = featureEngineering.prepareForPrediction(sortedAccounts);
            const response = await this.client.post('/api/v1/predict/batch', {
                accounts: preparedAccounts
            });
            return this._transformBatchResponse(response.data, sortedAccounts);
        } catch (error) {
            if (ML_FALLBACK_ENABLED) {
                logger.warn(`ML batch predict failed, falling back to rules: ${error.message}`);
                return ruleBasedScoring.scoreBatch(sortedAccounts);
            }
            throw error;
        }
    }

    /**
     * Chunked batch prediction for very large datasets
     * Processes in chunks to avoid overwhelming the ML service
     * @param {Array} accounts - Large array of accounts
     * @returns {Object} Combined results
     */
    async _predictBatchChunked(accounts) {
        logger.info(`Chunked processing: ${accounts.length} accounts in ${Math.ceil(accounts.length / ML_BATCH_SIZE)} chunks`);

        const allResults = [];
        let fakeCount = 0, suspiciousCount = 0, realCount = 0;
        let totalTrustScore = 0, totalProbability = 0;
        const highRiskAccounts = [];

        for (let i = 0; i < accounts.length; i += ML_BATCH_SIZE) {
            const chunk = accounts.slice(i, i + ML_BATCH_SIZE);
            const chunkNum = Math.floor(i / ML_BATCH_SIZE) + 1;

            logger.info(`Processing chunk ${chunkNum}/${Math.ceil(accounts.length / ML_BATCH_SIZE)}`);

            try {
                const preparedChunk = featureEngineering.prepareForPrediction(chunk);
                const response = await this.client.post('/api/v1/predict/batch', {
                    accounts: preparedChunk
                });

                const chunkResults = this._transformBatchResponse(response.data, chunk);
                allResults.push(...chunkResults.results);

                // Aggregate stats
                fakeCount += chunkResults.summary.fake_count;
                suspiciousCount += chunkResults.summary.suspicious_count;
                realCount += chunkResults.summary.real_count;
                totalTrustScore += chunkResults.summary.avg_trust_score * chunk.length;
                totalProbability += chunkResults.summary.avg_fake_probability * chunk.length;
                highRiskAccounts.push(...(chunkResults.summary.high_risk_accounts || []));

            } catch (error) {
                if (ML_FALLBACK_ENABLED) {
                    logger.warn(`Chunk ${chunkNum} failed, using fallback`);
                    const fallbackResults = ruleBasedScoring.scoreBatch(chunk);
                    allResults.push(...fallbackResults.results);
                    fakeCount += fallbackResults.summary.fake_count;
                    suspiciousCount += fallbackResults.summary.suspicious_count;
                    realCount += fallbackResults.summary.real_count;
                } else {
                    throw error;
                }
            }
        }

        return {
            success: true,
            total_accounts: accounts.length,
            processed: allResults.length,
            // DETERMINISM: Sort final results by account_id
            results: allResults.sort((a, b) =>
                (a.account_id || '').localeCompare(b.account_id || '')
            ),
            summary: {
                fake_count: fakeCount,
                suspicious_count: suspiciousCount,
                real_count: realCount,
                fake_percentage: Math.round((fakeCount / accounts.length) * 10000) / 100,
                suspicious_percentage: Math.round((suspiciousCount / accounts.length) * 10000) / 100,
                real_percentage: Math.round((realCount / accounts.length) * 10000) / 100,
                avg_trust_score: Math.round((totalTrustScore / accounts.length) * 10000) / 10000,
                avg_fake_probability: Math.round((totalProbability / accounts.length) * 10000) / 10000,
                high_risk_accounts: highRiskAccounts,
                processing_method: 'chunked'
            }
        };
    }

    /**
     * Train model with dataset
     * @param {Array} data - Training data array
     * @param {Object} options - Training options
     * @returns {Object} Training result with metrics
     */
    async trainModel(data, options = {}) {
        const {
            labelColumn = 'label',
            testSize = 0.2,
            useSmote = true,
            modelType = 'ensemble',
            saveModel = true
        } = options;

        try {
            const response = await this.client.post('/api/v1/train', {
                data,
                label_column: labelColumn,
                test_size: testSize,
                use_smote: useSmote,
                model_type: modelType,
                save_model: saveModel
            });

            logger.info(`Training completed: ${JSON.stringify(response.data.metrics)}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(error.response.data.detail || 'Training failed');
            }
            throw new Error(`Training connection error: ${error.message}`);
        }
    }

    /**
     * Train model with uploaded file
     * @param {Object} file - File object from multer
     * @param {Object} options - Training options
     */
    async trainWithFile(file, options = {}) {
        const FormData = require('form-data');
        const form = new FormData();

        form.append('file', file.buffer, file.originalname);
        form.append('label_column', options.labelColumn || 'label');
        form.append('test_size', String(options.testSize || 0.2));
        form.append('use_smote', String(options.useSmote !== false));
        form.append('model_type', options.modelType || 'ensemble');
        form.append('save_model', String(options.saveModel !== false));

        try {
            logger.info(`Sending file ${file.originalname} to ML service for training`);
            const response = await this.client.post('/api/v1/train/upload', form, {
                headers: {
                    ...form.getHeaders()
                }
            });
            logger.info(`Training completed: ${JSON.stringify(response.data.metrics)}`);
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(error.response.data.detail || 'Training failed');
            }
            throw new Error(`Training connection error: ${error.message}`);
        }
    }

    /**
     * Transform /predict response to match existing response format
     */
    _transformPredictResponse(predictResult, originalAccount) {
        return {
            account_id: originalAccount.account_id || predictResult.account_id,
            username: originalAccount.username || predictResult.username,
            fake_probability: predictResult.probability_score,
            anomaly_score: 1 - (predictResult.trust_score / 100),
            trust_score: predictResult.trust_score / 100,
            authenticity_score: predictResult.trust_score / 100,
            network_risk_score: predictResult.probability_score,
            behavioral_risk_score: predictResult.probability_score,
            classification: predictResult.classification,
            behavioral_indicators: predictResult.risk_factors.map(rf => ({
                indicator: rf.toLowerCase().replace(/\s+/g, '_'),
                severity: predictResult.probability_score >= 0.7 ? 'high' : 'medium',
                description: rf
            })),
            feature_snapshot: featureEngineering.accountToFeatures(originalAccount),
            scoring_method: 'ml_predict'
        };
    }

    /**
     * Transform batch /predict response to match existing format
     */
    _transformBatchResponse(batchResult, originalAccounts) {
        // DETERMINISM: Build lookup map by account_id for matching
        const accountMap = new Map(
            originalAccounts.map(acc => [acc.account_id, acc])
        );

        const results = batchResult.results.map((result) => {
            const originalAccount = accountMap.get(result.account_id) || {};
            return this._transformPredictResponse(result, originalAccount);
        });

        // DETERMINISM: Sort results by account_id
        results.sort((a, b) =>
            (a.account_id || '').localeCompare(b.account_id || '')
        );

        return {
            success: true,
            total_accounts: batchResult.total_accounts,
            processed: batchResult.processed,
            results,
            summary: {
                fake_count: batchResult.summary.fake_count,
                suspicious_count: batchResult.summary.suspicious_count,
                real_count: batchResult.summary.real_count,
                fake_percentage: batchResult.summary.fake_percentage,
                suspicious_percentage: batchResult.summary.suspicious_percentage,
                real_percentage: batchResult.summary.real_percentage,
                avg_trust_score: batchResult.summary.avg_trust_score / 100,
                avg_fake_probability: batchResult.summary.avg_probability,
                high_risk_accounts: results
                    .filter(r => r.fake_probability >= 0.8)
                    .map(r => r.account_id),
                processing_method: 'ml_predict'
            }
        };
    }
}

module.exports = new MLService();

