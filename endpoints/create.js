import * as uuid from "uuid";
import handler from "../libs/handler-lib";
import dynamoDb from "../libs/dynamodb-lib";
import Responses from '../libs/apiResponses-lib';
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();

export const main = handler(async (event, context) => {
  const data = JSON.parse(event.body);
  const createReferralParams = {
    TableName: process.env.tableName,
    Item: {
      referralId: uuid.v1(),
      userId: event.requestContext.identity.cognitoIdentityId,
      name: data.name,
      phone: data.phone,
      photo: data.photo,
      createdAt: Date.now()
    }
  };

  const counterExistsParams = {
    TableName: process.env.tableNameCount,
    Key: {
      userId: event.requestContext.identity.cognitoIdentityId,
    },
    AttributesToGet: [
      'userId'
    ]
  };

  const createCounterParams = {
    TableName: process.env.tableNameCount,
    Item: {
      userId: event.requestContext.identity.cognitoIdentityId,
      referralCount: 0
    }
  };

  const updateCounterParams = {
    TableName: process.env.tableNameCount,
    Key: {
      userId: event.requestContext.identity.cognitoIdentityId,
    },
    UpdateExpression: 'SET referralCount = referralCount + :incr',
    ExpressionAttributeValues: { ':incr': 1 },
  };

  await dynamoDb.put(createReferralParams);
  const result = await dynamoDb.get(counterExistsParams);
  if (result.Item === undefined || result.Item === null) {
    // Counter for this user not create yet...
    await dynamoDb.put(createCounterParams);
  }
  await dynamoDb.update(updateCounterParams);

  const emailPayload = {
    body: `{\"referralId\":\"${createReferralParams.Item.referralId}\"}`
  };

  const paramsLamdba = {
    // TODO: remove hardcoded dev stage name in function
    FunctionName: 'arn:aws:lambda:ap-southeast-1:924583607971:function:cfi-referral-api-dev-sendEmail',
    Payload: JSON.stringify(emailPayload),
    InvocationType: 'Event'
  };

  await lambda.invoke(paramsLamdba).promise();

  return Responses._200( createReferralParams.Item);
});