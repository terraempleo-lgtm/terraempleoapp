const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1',
});

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID;

module.exports = {
  cognitoClient,
  COGNITO_USER_POOL_ID,
  COGNITO_CLIENT_ID,
};
