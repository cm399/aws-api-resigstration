import {Container} from "typedi";
// TypeORM required.
require("dotenv").config();
import "reflect-metadata";
import * as http from 'http';
import {Action, getMetadataArgsStorage, useContainer, useExpressServer} from 'routing-controllers';
import {logger, wrapConsole, loggerConfig} from "./logger";
import {connect} from './typeorm';
import express, { Router } from 'express';

import {User} from './models/security/User';
import * as jwt from 'jwt-simple';
import {ErrorHandlerMiddleware} from "./middleware/ErrorHandlerMiddleware";
import {UserRoleEntity} from "./models/security/UserRoleEntity";
import {RoleFunction} from "./models/security/RoleFunction";
import {Function} from "./models/security/Function";
import * as admin from "firebase-admin";
import {validationMetadatasToSchemas} from "class-validator-jsonschema";
import {getFromContainer, MetadataStorage} from "class-validator";
import {routingControllersToSpec} from "routing-controllers-openapi";
import {RequestLogger} from "./middleware/RequestLogger";
import FirebaseService from "./services/security/FirebaseService";
import cors from "cors";
import { decrypt, isNullOrEmpty } from "./utils/Utils";
import { Role } from "./models/security/Role";
import { InstalmentScheduler } from "./scheduler/InstalmentScheduler";
import { CashTransferScheduler } from "./scheduler/CashTransferScheduler";
import { PerMatchScheduler } from "./scheduler/PerMatchFeeScheduler";

let envPromise = setEnvFromCredentialManager();

envPromise.then(function(){
    loggerConfig();
    wrapConsole();
    start().then(() => {
        logger.info("Application started.");
    }).catch((err) => {
        logger.error("Failed to start application", err);
    });
});

async function checkFirebaseUser(user, password: string) {
    if (isNullOrEmpty(user.firebaseUID)) {
        let fbUser = await FirebaseService.Instance().loadUserByEmail(user.email.toLowerCase());
        if (!fbUser || !fbUser.uid) {
            fbUser = await FirebaseService.Instance().createUser(user.email.toLowerCase(), password);
        }
        if (fbUser && fbUser.uid) {
            user.firebaseUID = fbUser.uid;
            await User.save(user);
        }
    }
    await checkFirestoreDatabase(user);
}

async function checkFirestoreDatabase(user) {
  if (!isNullOrEmpty(user.firebaseUID)) {
      let db = admin.firestore();
      let usersCollectionRef = await db.collection('users');
      let queryRef = usersCollectionRef.where('uid', '==', user.firebaseUID);
      let querySnapshot = await queryRef.get();
      if (querySnapshot.empty) {
        usersCollectionRef.doc(user.firebaseUID).set({
            'email': user.email.toLowerCase(),
            'firstName': user.firstName,
            'lastName': user.lastName,
            'uid': user.firebaseUID,
            'avatar': (user.photoUrl != null && user.photoUrl != undefined) ?
                user.photoUrl :
                null,
            'created_at': admin.firestore.FieldValue.serverTimestamp(),
            'searchKeywords': [
                `${user.firstName} ${user.lastName}`,
                user.firstName,
                user.lastName,
                user.email.toLowerCase()
            ]
        });
      }
  }
}

const handleCors = (router: Router) => router.use(cors({ /*credentials: true,*/ origin: true }));

async function start() {
    await connect();
    const app = express();
    useContainer(Container);

	 let instalmentScheduler = new InstalmentScheduler();
     instalmentScheduler.instalmentsSchedule();																							  
    
    let cashTransferScheduler = new CashTransferScheduler ();
    cashTransferScheduler.scheduleCashTransfer();	
    
    // let perMatchScheduler = new PerMatchScheduler ();
    // perMatchScheduler.perMatchScheduler();	
    handleCors(app);

    const routingControllersOptions = {
        controllers: [__dirname + "/controller/*", __dirname + "/models/registrations/*"],
    };

    const server = http.createServer(app);

    // Parse class-validator classes into JSON Schema:
    const metadatas = (getFromContainer(MetadataStorage) as any).validationMetadatas;
    const schemas = validationMetadatasToSchemas(metadatas, {
        refPointerPrefix: '#/components/schemas/'
    });

    useExpressServer(app, {
        controllers: [__dirname + "/controller/*", __dirname + "/models/registrations/*"],
        authorizationChecker: async (action: Action, roles: string[]) => {
            const token = action.request.headers.authorization;
            let sourcesystem = action.request.headers.sourcesystem;

            try {
                if (!token && roles && roles.length > 0 && roles.indexOf("spectator") !== -1) {
                    return true
                }
                const data = jwt.decode(decrypt(token), process.env.SECRET).data.split(':');
                // let cachedUser = fromCacheAsync(token);
                let user = null;
                let query = null;
                // if (!cachedUser) {

                    if(sourcesystem == 'WebAdmin'){
                        query = User.createQueryBuilder('user')
                                    .innerJoin(UserRoleEntity, 'ure', 'user.id = ure.userId and ure.entityType = 2 and ure.isDeleted = 0')
                                    .innerJoin(Role, 'role', 'role.id = ure.roleId and role.applicableToWeb = 1 and role.isDeleted = 0')
                                    .andWhere('LOWER(user.email) = :email and user.password = :password and user.isDeleted = 0',
                            {email: data[0].toLowerCase(), password: data[1]});
                    }
                    else{
                        query = User.createQueryBuilder('user').andWhere(
                            'LOWER(user.email) = :email and user.password = :password and user.isDeleted = 0',
                            {email: data[0].toLowerCase(), password: data[1]});
                    }

                if (action.request.url == '/users/profile' && action.request.method == 'PATCH')
                    query.addSelect("user.password");
                user = await query.getOne();
                // toCacheWithTtl(token, JSON.stringify(user), TEN_MIN);
                // } else {
                //     user = JSON.parse(cachedUser);
                // }

                if (user) {
                    let userId = user.id;
                    if (roles && roles.length > 0) {
                        if (roles.length == 1 && roles.indexOf("spectator") !== -1) {
                            logger.info(`Ignore check role permission for spectator`);
                        } else {
                            let exist = await UserRoleEntity.createQueryBuilder('ure')
                                .select('count(ure.id)', 'count')
                                .innerJoin(RoleFunction, 'rf', 'rf.roleId = ure.roleId')
                                .innerJoin(Function, 'f', 'f.id = rf.functionId')
                                .where('ure.userId = :userId and f.name in (:roles)', {userId, roles})
                                .getRawOne();

                            if (parseInt(exist['count']) <= 0) {
                                return false;
                            }
                        }
                    }
                    await checkFirebaseUser.call(this, user, data[1]);

                    action.request.headers.authorization = user;
                }
                return !!user;
            } catch (e) {
                return false;
            }
        },
        defaultErrorHandler: false
        // middlewares: [AuthenticationMiddleware]
        , middlewares: [RequestLogger, ErrorHandlerMiddleware]
    });

    let projId = JSON.parse(process.env.firebaseCertAdminConfig).projectId;
    let cred = admin.credential.cert(JSON.parse(process.env.firebaseCertAdminConfig));

    admin.initializeApp({
        credential: cred,
        databaseURL: `https://${projId}.firebaseio.com`
    });

    app.set('view engine', 'ejs');

    // Parse routing-controllers classes into OpenAPI spec:
    const storage = getMetadataArgsStorage();
    const spec = routingControllersToSpec(storage, routingControllersOptions, {
        components: {
            schemas,
            securitySchemes: {
                basicAuth: {
                    scheme: 'basic',
                    type: 'http'
                }
            }
        },
        info: {
            title: 'WSA API',
            version: '1.0.0'
        }
    });

    // Render spec on root:
    app.get('/api/docs.json', (_req, res) => {
        res.json(spec)
    });

    server.timeout = 300000;
    server.listen(process.env.PORT, () => {
        logger.info(`Server listening on port ${process.env.PORT}`);
    });
}

function setEnvFromCredentialManager(){
    let promise = new Promise(function(resolve, reject) {
        var AWS = require('aws-sdk'),
        region = process.env.REGION,
        secretName = process.env.SECRET_NAME,
        accessKeyId = process.env.ACCESS_KEY_ID,
        secretAccessKey = process.env.SECRET_ACCESS_KEY,
        secret,
        decodedBinarySecret;
    
        var client = new AWS.SecretsManager({
            region: region,
            accessKeyId,
            secretAccessKey
        });
    
        client.getSecretValue({SecretId: secretName}, function(err, data) {
            if (err) {
                console.log("If entry With error" + err);
                reject();
            }
            else {
                if ('SecretString' in data) {
                    secret = data.SecretString;
                    let secretData = JSON.parse(secret)
                    let keys = Object.keys(secretData);
                    for(let key of keys){
                        process.env[key] = secretData[key];
                    }
                   
                } else {
                    let buff = new Buffer(data.SecretBinary, 'base64');
                    decodedBinarySecret = buff.toString('ascii');
                    let secretData = JSON.parse(decodedBinarySecret)
                    let keys = Object.keys(secretData);
                    for(let key of keys){
                        process.env[key] = secretData[key];
                    }
                }
    
                resolve([]);
            }
        });
    })
    return promise;
}
