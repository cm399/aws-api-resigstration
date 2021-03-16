import dateFormat from 'dateformat';
import moment from "moment";
import nodeMailer from "nodemailer";
import { Service } from "typedi";
import { Brackets } from "typeorm";

import EmailConstants from "../../constants/EmailConstants";
import { logger } from "../../logger";
import { CommunicationTemplate } from "../../models/common/CommunicationTemplate";
import { CommunicationTrack } from "../../models/common/CommunicationTrack";
import { ParticipantRegistrationInfoDto } from '../../models/dto/ParticipantRegistrationInfoDto';
import { ParticipantRegistrationInfoPlayerDto } from '../../models/dto/ParticipantRegistrationInfoPlayerDto';
import { ParticipantRegistrationInfoProductDto } from '../../models/dto/ParticipantRegistrationInfoProductDto';
import { EntityType } from "../../models/security/EntityType";
import { Function } from "../../models/security/Function";
import { Organisation } from "../../models/security/Organisation";
import { Role } from "../../models/security/Role";
import { RoleFunction } from "../../models/security/RoleFunction";
import { User } from "../../models/security/User";
import { getParentEmail, isArrayPopulated, isNotNullAndUndefined, isStringNullOrEmpty } from "../../utils/Utils";
import AppConstants from "../../validation/AppConstants";
import BaseService from "../BaseService";

@Service()
export default class UserService extends BaseService<User> {

    modelName(): string {
        return User.name;
    }

    public async findByEmail(email: string): Promise<User> {
        return this.entityManager.createQueryBuilder(User, 'user')
            .andWhere('LOWER(user.email) = :email', { email: email.toLowerCase().trim() })
            .addSelect("user.password").addSelect("user.reset")
            .getOne();
    }

    public async findByCredentials(email: string, password: string): Promise<User> {
        return this.entityManager.createQueryBuilder(User, 'user')
            .andWhere('LOWER(user.email) = :email and user.password = :password', {
                email: email.toLowerCase(),
                password: password
            })
            .getOne();
    }

    public async findByFullName(name: string): Promise<User[]> {
        let builder = this.entityManager.createQueryBuilder(User, 'user')
            .where('LOWER(user.firstName) like :query', { query: `${name.toLowerCase()}%` })
            .orWhere('LOWER(user.lastName) like :query', { query: `${name.toLowerCase()}%` });
        return builder.getMany();
    }

    public async findByTeamId(teamId: number): Promise<User[]> {
        return this.entityManager.createQueryBuilder(User, 'user')
            .innerJoin('scorers', 'scorers', 'scorers.userId = user.id')
            .innerJoin('team', 'team', 'team.id = scorers.teamId')
            .where('scorers.teamId = :teamId', { teamId }).getMany();
    }

    public async findByToken(token: string): Promise<User> {
        return this.entityManager.createQueryBuilder(User, 'user')
            .andWhere('user.reset = :token', { token: token })
            .addSelect("user.reset")
            .getOne();
    }

    public async userExist(email: string): Promise<number> {
        return this.entityManager.createQueryBuilder(User, 'user')
            .where('LOWER(user.email) = :email', { email: email.toLowerCase() })
            .getCount()
    }

    public async update(email: string, user: User) {
        return this.entityManager.createQueryBuilder(User, 'user')
            .update(User)
            .set(user)
            .andWhere('LOWER(user.email) = :email', { email: email.toLowerCase() })
            .execute();
    }

    public async updatePhoto(userId: number, photoUrl: string) {
        return this.entityManager.createQueryBuilder(User, 'user')
            .update(User)
            .set({ photoUrl: photoUrl })
            .andWhere('user.id = :userId', { userId })
            .execute();
    }

    public async getUserPermission(userId: number): Promise<any[]> {
        return this.entityManager.query(
            'select distinct r.id as id,\n' +
            '       r.name as name,\n' +
            '       (select concat(\'[\', group_concat(JSON_OBJECT(\'id\', fn.id, \'name\', fn.name)),\']\')\n' +
            '         from functionRole rf2 inner join `function` fn on rf2.functionId = fn.id ' +
            '           where rf2.roleId = r.id) as functions\n' +
            'from userRoleEntity ure\n' +
            '         inner join functionRole rf on ure.roleId = rf.roleId\n' +
            '         inner join role r on rf.roleId = r.id\n' +
            '         inner join `function` f on rf.functionId = f.id\n' +
            'where ure.userId = ? group by id, name, functions;'
            , [userId])
    }

    public async getRoles(): Promise<any[]> {
        return this.entityManager.createQueryBuilder(Role, 'r')
            .select(['r.id as id', 'r.name as name'])
            .getRawMany();
    }

    public async getRole(roleName: string): Promise<any> {
        return this.entityManager.createQueryBuilder(Role, 'r')
            .select(['r.id as id', 'r.name as name'])
            .where('r.name = :roleName', { roleName })
            .getRawOne();
    }

    public async getFunctions(): Promise<any[]> {
        return this.entityManager.createQueryBuilder(Function, 'f')
            .select(['f.id as id', 'f.name as name'])
            .getRawMany();
    }

    public async getFunctionsByRole(roleId: number): Promise<any[]> {
        return this.entityManager.createQueryBuilder(Function, 'f')
            .select(['f.id as id', 'f.name as name'])
            .innerJoin(RoleFunction, 'rf', 'rf.functionId = f.id')
            .where('rf.roleId = :roleId', { roleId })
            .getRawMany();
    }

    public async getRoleFunctions(): Promise<any[]> {
        let result = await this.entityManager.query('select r.id as id,\n' +
            '       r.name as name,\n' +
            '       (select concat(\'[\', group_concat(JSON_OBJECT(\'id\', fn.id, \'name\', fn.name)),\']\')\n' +
            '         from functionRole rf2 inner join `function` fn on rf2.functionId = fn.id ' +
            '           where rf2.roleId = r.id) as functions\n' +
            'from functionRole rf\n' +
            '         inner join role r on rf.roleId = r.id\n' +
            '         inner join `function` f on rf.functionId = f.id\n' +
            'group by id, name, functions;');

        for (let p of result) {
            p['functions'] = JSON.parse(p['functions']);
        }
        return result;
    }

    public async getEntityTypes(): Promise<any[]> {
        return this.entityManager.createQueryBuilder(EntityType, 'et')
            .select(['et.id as id', 'et.name as name'])
            .getRawMany();
    }

    public async getEntityType(entityTypeName: string): Promise<any> {
        return this.entityManager.createQueryBuilder(EntityType, 'et')
            .select(['et.id as id', 'et.name as name'])
            .where('et.name = :entityTypeName', { entityTypeName })
            .getRawOne();
    }

    public async findUserByMatchingDetails(userObj) {
        try {
            let userDb = null

            if (userObj) {
                userDb = await this.entityManager.createQueryBuilder(User, 'user')
                    .where(
                        'LOWER(TRIM(user.firstName)) = :firstName and LOWER(TRIM(user.lastName)) = :lastName and user.mobileNumber = :mobileNumber',
                        {
                            firstName: userObj.firstName.toLowerCase().trim(),
                            lastName: userObj.lastName.toLowerCase().trim(),
                            mobileNumber: userObj.mobileNumber
                        }
                    )
                    .getOne()

                if (!userDb) {
                    let dob = moment(userObj.dateOfBirth).format("YYYY/MM/DD");
                    logger.info(' -- Date Of Birth ==   ' + dob);
                    userDb = await this.entityManager.createQueryBuilder(User, 'user')
                        .where(
                            'LOWER(TRIM(user.firstName)) = :firstName and user.dateOfBirth = :dateOfBirth and LOWER(TRIM(user.lastName)) = :lastName',
                            {
                                firstName: userObj.firstName.toLowerCase().trim(),
                                dateOfBirth: dob,
                                lastName: userObj.lastName.toLowerCase().trim(),
                            }
                        )
                        .getOne()
                }
            }
            return userDb;
        } catch (error) {
            throw error;
        }
    }

    public async getUsersBySecurity(
        entityTypeId: number,
        entityId: number,
        userName: string,
        sec: { functionId?: number, roleId?: number }
    ): Promise<any[]> {
        let query = this.entityManager.createQueryBuilder(User, 'u')
            .select(['u.id as id', 'LOWER(u.email) as email', 'u.firstName as firstName', 'u.lastName as lastName',
                'u.mobileNumber as mobileNumber', 'u.gender as gender',
                'u.marketingOptIn as marketingOptIn', 'u.photoUrl as photoUrl'])
            .addSelect('concat(\'[\', group_concat(distinct JSON_OBJECT(\'entityTypeId\', ' +
                'le.linkedEntityTypeId, \'entityId\', le.linkedEntityId, \'name\', le.linkedEntityName)),\']\') ' +
                'as linkedEntity')
            .innerJoin('UserRoleEntity', 'ure', 'u.id = ure.userId')
            .innerJoin('RoleFunction', 'fr', 'fr.roleId = ure.roleId')
            .innerJoin('LinkedEntities', 'le', 'le.linkedEntityTypeId = ure.entityTypeId AND ' +
                'le.linkedEntityId = ure.entityId');

        if (sec.functionId) {
            let id = sec.functionId;
            query.innerJoin('Function', 'f', 'f.id = fr.functionId')
                .andWhere('f.id = :id', { id });
        }

        if (sec.roleId) {
            let id = sec.roleId;
            query.innerJoin('Role', 'r', 'r.id = fr.roleId')
                .andWhere('r.id = :id', { id });
        }

        query.andWhere('le.inputEntityTypeId = :entityTypeId', { entityTypeId })
            .andWhere('le.inputEntityId = :entityId', { entityId });

        if (userName) {
            query.andWhere(new Brackets(qb => {
                qb.andWhere('LOWER(u.firstName) like :query', { query: `${userName.toLowerCase()}%` })
                    .orWhere('LOWER(u.lastName) like :query', { query: `${userName.toLowerCase()}%` });
            }));
        }
        query.groupBy('u.id');
        return query.getRawMany()
    }

    public async getUsersByIdWithLinkedEntity(userId: number): Promise<any> {
        return this.entityManager.createQueryBuilder(User, 'u')
            .select(['u.id as id', 'LOWER(u.email) as email', 'u.firstName as firstName', 'u.lastName as lastName',
                'u.mobileNumber as mobileNumber', 'u.gender as gender',
                'u.marketingOptIn as marketingOptIn', 'u.photoUrl as photoUrl'])
            .addSelect('concat(\'[\', group_concat(distinct JSON_OBJECT(\'entityTypeId\', ' +
                'le.linkedEntityTypeId, \'entityId\', le.linkedEntityId, \'name\', le.linkedEntityName)),\']\') ' +
                'as linkedEntity')
            .innerJoin('UserRoleEntity', 'ure', 'u.id = ure.userId')
            .innerJoin('RoleFunction', 'fr', 'fr.roleId = ure.roleId')
            .innerJoin('LinkedEntities', 'le', 'le.linkedEntityTypeId = ure.entityTypeId AND ' +
                'le.linkedEntityId = ure.entityId')
            .andWhere('ure.userId = :userId', { userId })
            .getRawOne();
    }

    public async getUserListByIds(ids: number[]): Promise<User[]> {
        return this.entityManager.createQueryBuilder(User, 'u')
            .select(['u.id as id', 'u.firstName as firstName', 'u.lastName as lastName'])
            .andWhere('u.id in (:ids)', { ids })
            .getRawMany();
    }

    public async findByNameAndNumber(firstName: string, lastName: string, mobileNumber: string): Promise<User> {
        try {
            let query = await this.entityManager.createQueryBuilder(User, 'user')
                .where(
                    'LOWER(user.firstName) = :firstName and LOWER(user.lastName) = :lastName and user.mobileNumber = :mobileNumber',
                    {
                        firstName: firstName.toLowerCase(),
                        lastName: lastName.toLowerCase(),
                        mobileNumber: mobileNumber
                    }
                )
                .getOne()
            return query;
        } catch (error) {
            throw error;
        }
    }

    public async findUserByUniqueFields(email: string, firstName: string, lastName: string, mobileNumber: string): Promise<User> {
        try {
            let query = await this.entityManager
                .createQueryBuilder(User, "user")
                .where(
                    "LOWER(user.email) = :email and user.firstName = :firstName and user.lastName = :lastName and user.mobileNumber = :mobileNumber",
                    {
                        email: email,
                        firstName: firstName,
                        lastName: lastName,
                        mobileNumber: mobileNumber,
                    }
                )
                .getOne();
            return query;
        } catch (error) {
            throw error;
        }
    }

    public async getUserInfo(userId: number): Promise<any> {
        try {
            let userData = null;
            let query = await this.entityManager.query(`select firstName, middleName, lastName, postalCode, street1, street2, suburb, 
                        (select r.description from wsa_common.reference r where referenceGroupId = 37 and r.id = u.stateRefId and r.isDeleted = 0)
                        as state
                        from wsa_users.user u where id = ? and u.isDeleted = 0`, [userId]);
            if (isArrayPopulated(query)) {
                userData = query.find(x => x);
            }
            return userData;
        } catch (error) {
            throw error;
        }
    }

    public async updateUserWithAccountId(userId: number, stripeKey: string): Promise<Organisation> {
        const currentTime = new Date();
        return await this.entityManager.query(
            `update wsa_users.user set stripeAccountId = ?, updatedOn = ? where id = ?`,
            [stripeKey, currentTime, userId]);
    }

    public async findUserByUserId(userId: number): Promise<Organisation> {
        return await this.entityManager.query(`select * from wsa_users.user where id = ?`, [userId]);
    }

    public async getUserParents(userId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`select u.* from wsa_users.user u 
            inner join wsa_users.userRoleEntity ure 
            on ure.userId = u.id and ure.roleId = 9 and ure.isDeleted = 0
            where u.isDeleted = 0 and ure.entityId = ?`, [userId]);

            return result;
        } catch (error) {
            throw error;
        }
    }

    public async updateMatchUmpirePaymentStatus(matchUmpireId: number, status: 'paid' | 'approved', approvedBy: number = undefined): Promise<any> {
        try {
            if (status === 'approved') {
                const currentTime = new Date();
                await this.entityManager.query(`update wsa.matchUmpire set paymentStatus = ?, approved_at = ?, 
                approvedByUserId = ? where id = ?`, [status, currentTime, approvedBy, matchUmpireId]);
            } else {
                await this.entityManager.query(`update wsa.matchUmpire set paymentStatus = ? where id = ?`, [status, matchUmpireId]);
            }
        } catch (error) {
            throw error;
        }
    }

    public async insertIntoCommunicationTrack(ctrack: CommunicationTrack) {
        await this.entityManager.query(
            `insert into wsa_common.communicationTrack(id, emailId,content,subject,contactNumber,userId,entityId,communicationType,statusRefId,deliveryChannelRefId,createdBy) values(?,?,?,?,?,?,?,?,?,?,?)`,
            [ctrack.id, ctrack.emailId, ctrack.content, ctrack.subject, ctrack.contactNumber, ctrack.userId, ctrack.entityId, ctrack.communicationType, ctrack.statusRefId, ctrack.deliveryChannelRefId, ctrack.createdBy]
        );
    }

    public async sendRegoFormInvites(contact, templateObj, competition, orgRegCreated, organisation, userId) {
        try {
            let url = process.env.REGISTRATION_FORM_URL;

            let day = dateFormat(new Date(), "yyyy-mm-dd h:MM:ss");
            templateObj.emailSubject = templateObj.emailSubject.replace(EmailConstants.affiliateName, organisation.name);
            templateObj.emailSubject = templateObj.emailSubject.replace(EmailConstants.competitionName, competition.name);
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.userFirstName, contact.firstName);
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.userLastName, contact.lastName);
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.affiliateName, organisation.name);
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.competitionName, competition.name);
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.competionStartDate, dateFormat(competition.startDate, "dd mmm yyyy"));
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.regoOpenDate, dateFormat(orgRegCreated.registrationOpenDate, "dd mmm yyyy"));
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.regoCloseDate, dateFormat(orgRegCreated.registrationCloseDate, "dd mmm yyyy"));
            if (competition.description == "") {
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.competitionDescription, "");
            } else {
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.competitionDescription, competition.description + "<br/><br/>");
            }
            if (orgRegCreated.trainingDaysAndTimes == null || orgRegCreated.trainingDaysAndTimes == "" || orgRegCreated.trainingDaysAndTimes == undefined) {
                templateObj.emailBody = templateObj.emailBody.replace("$(Affiliate.name) will run training on $(Rego.form.training.days).<br/><br/>", "");
            } else {
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.affiliateName, organisation.name);
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.regoTrainingDays, orgRegCreated.trainingDaysAndTimes);
            }

            if (
                (orgRegCreated.replyEmail == null || orgRegCreated.replyEmail == "" || orgRegCreated.replyEmail == undefined) &&
                (orgRegCreated.replyName == null || orgRegCreated.replyName == "" || orgRegCreated.replyName == undefined) &&
                (orgRegCreated.replyPhone == null || orgRegCreated.replyPhone == "" || orgRegCreated.replyPhone == undefined)
            ) {
                templateObj.emailBody = templateObj.emailBody.replace(
                    'Contact $(contact.name) from $(Affiliate.name) on <a href="$(rego.form.contact.mail)"> $(email)</a> $(or) <a href="$(rego.form.contact.mobile)"> $(mobile)</a> for more information.<br/><br/>',
                    ''
                );
            } else {
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.fromContactEmailLink, "mailto:" + orgRegCreated.replyEmail);
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.fromContactEmail, orgRegCreated.replyEmail);
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.fromContactName, orgRegCreated.replyName);
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.affiliateName, organisation.name);
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.fromContactMobileLink, "tel:" + orgRegCreated.replyPhone);
                templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.fromContactMobile, orgRegCreated.replyPhone);
            }

            if (orgRegCreated.replyPhone == null || orgRegCreated.replyPhone == "") {
                templateObj.emailBody = templateObj.emailBody.replace("$(or)", "");
            } else if (orgRegCreated.replyEmail == null || orgRegCreated.replyEmail == "") {
                templateObj.emailBody = templateObj.emailBody.replace("$(or)", "");
            } else {
                templateObj.emailBody = templateObj.emailBody.replace("$(or)", "or");
            }
            templateObj.emailBody = templateObj.emailBody.replace('<a href="tel:"> </a>', '');
            templateObj.emailBody = templateObj.emailBody.replace('<a href="mailto:"> </a>', '');

            url = url.replace("{ORGANISATIONID}", organisation.organisationUniqueKey);
            url = url.replace("{COMPETITIONID}", competition.competitionUniqueKey);
            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.registerLink, url);

            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.affiliateName, organisation.name);

            templateObj.emailBody = templateObj.emailBody.replace(EmailConstants.affiliateName, organisation.name);

            let subject = templateObj.emailSubject;
            let emailHtml = this.composeEmail("You're Invited!", templateObj.emailBody, contact, null);

            await this.sendAndLogEmail(contact.email, contact.isInActive, contact.id, subject, emailHtml, "", 4, orgRegCreated.id, userId);

        } catch (error) {
            throw error;
        }
    }

    public async sendTeamRegisterConfirmationMail(
        resBody, template: CommunicationTemplate, userId, password, registrationId, fileName, invoiceReciever, futureInstalments
    ) {
        try {
            let subject = template.emailSubject;
            let url = process.env.USER_REGISTRATION_FORM_URL;
            //  let html = ``;
            subject = subject.replace(AppConstants.teamName, resBody.teamName);

            //templateObj.emailSubject = templateObj.emailSubject.replace('$(Affiliate.name)', compOrganisationName);
            //templateObj.emailSubject = templateObj.emailSubject.replace('$(Competition.name)', findCompetition.name)
            template.emailBody = template.emailBody.replace(AppConstants.registerPersonName, resBody.firstName + " " + resBody.lastName);
            template.emailBody = template.emailBody.replace(AppConstants.teamName, resBody.teamName);
            template.emailBody = template.emailBody.replace(AppConstants.affiliateName, resBody.organisationName);
            template.emailBody = template.emailBody.replace(AppConstants.competionName, resBody.competitionName);
            template.emailBody = template.emailBody.replace(AppConstants.competionName, resBody.competitionName);
            template.emailBody = template.emailBody.replace(AppConstants.regCloseDate, resBody.registrationCloseDate);
            template.emailBody = template.emailBody.replace(AppConstants.startDate, resBody.startDate);
            template.emailBody = template.emailBody.replace(AppConstants.url, url);
            if (isArrayPopulated(resBody.players)) {
                template.emailBody = template.emailBody.replace(AppConstants.teamName, resBody.teamName);
                let str = "";

                let paidMembers = resBody.players.filter((x) => x.paid != null);
                let notPaidMembers = resBody.players.filter((x) => x.notPaid != null);
                if (isArrayPopulated(paidMembers)) {
                    str += AppConstants.youHavePaidFor;
                    for (let p of paidMembers) {
                        let registered = "";
                        if (p.haveToPay == null) registered = AppConstants.registered;
                        str += "<li>";
                        str += p.firstName + " " + p.lastName + " - " + p.productType + " - " + registered + ". " + AppConstants.youPaid + " - " + "$" + p.paid.toFixed(2);
                        str += "</li>";
                    }
                }
                if (isArrayPopulated(notPaidMembers)) {
                    str += AppConstants.youHaveNotPaidFor;
                    let memberNames = [];
                    for (let p of notPaidMembers) {
                        if (p.haveToPay != null) {
                            str += "<li>";
                            str += p.firstName + " " + p.lastName + " - " + p.productType + " - " + AppConstants.amountOwing + " - " + "$" + p.notPaid.toFixed(2);
                            str += "</li>";
                            let memberName = p.firstName + " " + p.lastName;
                            memberNames.push(memberName);
                        }
                    }
                    let notPaidMembersString = await this.separateWithAnd(memberNames);
                    template.emailBody = template.emailBody.replace(AppConstants.notPaidMembers, notPaidMembersString);
                } else {
                    template.emailBody = template.emailBody.replace(AppConstants.chargedIfNotPaidFees, "");
                }
                template.emailBody = template.emailBody.replace(AppConstants.listNameAndRole, str);
            }

            let str1 = "";
            if (isArrayPopulated(futureInstalments)) {
                for (let fi of futureInstalments) {
                    str1 += "<li>";
                    str1 += AppConstants.date;
                    str1 += " - $";
                    str1 += AppConstants.amount;
                    str1 += "</li>";
                    str1 = str1.replace(AppConstants.date, fi.date);
                    str1 = str1.replace(AppConstants.amount, fi.amount.toFixed(2));
                }
            } else {
                template.emailBody = template.emailBody.replace(AppConstants.installmentPaymentDeductedOn, "");
            }
            template.emailBody = template.emailBody.replace(AppConstants.installmentDateAndAmount, str1);
            if (resBody.teamRegChargeTypeRefId == 1) {
                template.emailBody = template.emailBody.replace(AppConstants.perMatchFeeTemplate, "");
            } else if (resBody.teamRegChargeTypeRefId != 4) {
                template.emailBody = template.emailBody.replace(AppConstants.eachPlayer, AppConstants.you);
            }
            template.emailBody = template.emailBody.replace(AppConstants.perMatchFee, "$" + (Number(resBody.teamSeasonalFees) + Number(resBody.teamSeasonalGST)));

            if (resBody.password != null) {
                template.emailBody = template.emailBody.replace(AppConstants.userNameAndPassword, "");
            }
            template.emailBody = template.emailBody.replace(AppConstants.userName, resBody.email);
            template.emailBody = template.emailBody.replace(AppConstants.password$, password);

            template.emailBody = template.emailBody.replace(AppConstants.replyName, resBody.replyName);
            template.emailBody = template.emailBody.replace(AppConstants.replyEmail, resBody.replyEmail);
            template.emailBody = template.emailBody.replace(AppConstants.replyPhone, resBody.replyPhone);
            if (resBody.replyEmail == null || resBody.replyEmail == "" || resBody.replyPhone == null || resBody.replyPhone == "") {
                template.emailBody = template.emailBody.replace(AppConstants.or, "");
            } else if (resBody.replyEmail != null && resBody.replyEmail != "" && resBody.replyPhone != null && resBody.replyPhone != "") {
                template.emailBody = template.emailBody.replace(AppConstants.or, "or");
            }
            template.emailBody = template.emailBody.replace(AppConstants.regFormAffiliateName, resBody.organisationName);

            // templateObj.emailBody = templateObj.emailBody.replace('$(rego_form_user_name)', );
            template.emailBody = template.emailBody.replace(AppConstants.affiliateName, resBody.organisationName);
            template.emailBody = template.emailBody.replace(AppConstants.affiliateName, resBody.organisationName);

            let addressee = new User;
            addressee.firstName = resBody.firstName;
            addressee.lastName = resBody.lastName;
            // !!! temporarily not sending password through template format - leaving above code in tact
            let emailHtml = this.composeEmail(template.title, template.emailBody, addressee, null);

            await this.sendAndLogEmail(resBody.creatorEmail, resBody.isInActive, resBody.userId, subject, emailHtml, password, 2, registrationId, userId);
            // if (invoiceReciever == 4) {
            //     mailOptions['attachments'] = [
            //         {
            //             filename: 'invoice.pdf', // <= Here: made sure file name match
            //             path: path.join(__dirname, '../../output/' + fileName), // <= Here
            //             contentType: 'application/pdf'
            //         }
            //     ]
            // }
        } catch (error) {
            throw error;
        }
    }

    public async sendTeamRegisterPlayerInviteMail(
        participant: ParticipantRegistrationInfoDto,
        player: ParticipantRegistrationInfoPlayerDto,
        template: CommunicationTemplate,
        userId: number,
        password: string,
        registrationId: number,
        roleArray: string[]
    ) {

        try {
            let subject = template.emailSubject;
            subject = subject.replace(AppConstants.teamName, participant.teamName);
            let url = process.env.TEAM_REGISTRATION_URL;
            //  let html = ``;
            url = url.replace(AppConstants.userRegUniquekey, player.userRegUniqueKey);
            template.emailBody = template.emailBody.replace(AppConstants.name, player.firstName + " " + player.lastName);
            template.emailBody = template.emailBody.replace(AppConstants.registerPersonName, participant.firstName + " " + participant.lastName);
            template.emailBody = template.emailBody.replace(AppConstants.teamName, participant.teamName);
            let divisionName = "";
            if (!isArrayPopulated(roleArray)) {
                template.emailBody = template.emailBody.replace(AppConstants.inDivision, "");
            } else {
                divisionName = roleArray[0];
            }
            template.emailBody = template.emailBody.replace(AppConstants.division, divisionName);
            template.emailBody = template.emailBody.replace(AppConstants.competionName, participant.products[0].competitionName);
            template.emailBody = template.emailBody.replace(AppConstants.startDate, participant.products[0].startDate);

            if (player.notPaid == null) {
                template.emailBody = template.emailBody.replace(AppConstants.completeYouRegistration, AppConstants.updateYourProfile);
                template.emailBody = template.emailBody.replace(AppConstants.registerBoforeCloseDate, "");
            }
            template.emailBody = template.emailBody.replace(AppConstants.url, url);
            if (password == null) {
                template.emailBody = template.emailBody.replace(AppConstants.userNameAndPassword, "");
            }

            template.emailBody = template.emailBody.replace(AppConstants.userName, player.email);
            template.emailBody = template.emailBody.replace(AppConstants.password$, password);
            template.emailBody = template.emailBody.replace(AppConstants.startDate, participant.products[0].startDate);
            template.emailBody = template.emailBody.replace(AppConstants.competionName, participant.products[0].competitionName);
            template.emailBody = template.emailBody.replace(AppConstants.regCloseDate, participant.products[0].registrationCloseDate);
            template.emailBody = template.emailBody.replace(AppConstants.startDate, participant.products[0].startDate);
            template.emailBody = template.emailBody.replace(AppConstants.url, url);
            template.emailBody = template.emailBody.replace(AppConstants.registerPersonName, participant.firstName + " " + participant.lastName);
            template.emailBody = template.emailBody.replace(AppConstants.registerPersonNumber, participant.mobileNumber);
            template.emailBody = template.emailBody.replace(AppConstants.affiliateName, participant.products[0].organisationName);
            template.emailBody = template.emailBody.replace(AppConstants.affiliateName, participant.products[0].organisationName);

            let title = template.title;
            if (player.notPaid == null) {
                title = AppConstants.updateYourProfileTitle;
            }
            let emailHtml = this.composeEmail(title, template.emailBody, player, null);
            await this.sendAndLogEmail(player.email, player.isInActive, participant.user.id, subject, emailHtml, password, 2, registrationId, userId);
        } catch (error) {
            throw error;
        }
    }

    public async sendIndividualMailNonRegisterer(
        participant: ParticipantRegistrationInfoDto,
        template: CommunicationTemplate,
        password: string,
        userId: number,
        registrationId: number,
        filename: string,
        invoiceReceiver: number
    ) {
        try {
            let registrants = '';
            let contacts = '';
            let comps: string[] = [];
            let orgs: string[] = [];

            if (isArrayPopulated(participant.products)) {
                for (let product of participant.products) {
                    this.getParticipantHtml(participant, product, false, true, true);
                    if (comps.indexOf(product.competitionName + product.organisationName) == -1) {
                        comps.push(product.competitionName + product.organisationName)
                        contacts += this.getContactsHtml(product);
                    }
                    if (orgs.indexOf(product.organisationName) == -1) {
                        orgs.push(product.organisationName)
                    }
                }
            }

            let subject = template.emailSubject;
            template.emailBody = template.emailBody.replace(EmailConstants.creatorName, participant.creator.firstName + " " + participant.creator.lastName);
            template.emailBody = template.emailBody.replace(EmailConstants.profileLink, process.env.USER_REGISTRATION_FORM_URL);
            template.emailBody = template.emailBody.replace(EmailConstants.registrants, registrants);
            let registrantContact = `<p><strong>${participant.creator.firstName} ${participant.creator.lastName}</strong></p>`;
            template.emailBody = template.emailBody.replace(EmailConstants.contacts, registrantContact + contacts);
            template.emailBody = template.emailBody.replace(EmailConstants.affiliateName, await this.separateWithAnd(orgs));

            let emailHtml = this.composeEmail(template.title, template.emailBody, participant.user, password);
            await this.sendAndLogEmail(participant.email, participant.isInActive, participant.user.id, subject, emailHtml, password, 1, registrationId, participant.creator.id);
        } catch (error) {
            logger.error(` ERROR occurred in individual mail ` + error);
            throw error;
        }
    }

    public async sendIndividualMail(
        participant: ParticipantRegistrationInfoDto,
        template: CommunicationTemplate,
        password: string,
        userId: number,
        registrationId: number,
        fileName: string,
        invoiceReciever: number,
        participants: ParticipantRegistrationInfoDto[]
    ) {
        try {
            /* Registrants HTML
                        <tr>
                            <td align="left" valign="top" class="ind-left">
                                <strong>Baby Smith **</strong>
                            </td>
                            <td align="right" valign="top" class="ind-right">
                                <strong>Player</strong>
                            </td>
                        <tr>
                            <td colspan="2" class="ind-subtext">
                                Metropolitan District Netball Association<br/>
                                2021 Summer Comp 7-9 Years Twilight Competition (starts 02 Feb 2020)
                            </td>
                        </tr>
            */

            /* Contacts HTML
                 <p><strong>Summer 2021 7-9 Twilight Season</strong> - Metropolitan District Netball Association - <a href="phoenx@gmail.com">metropolitandistrictnetball.org.au</a></p>
             </div>
             */
            let registrants = '';
            let contacts = '';
            let comps: string[] = [];
            let orgs: string[] = [];
            let others: string[] = [];
            let showChildDisclaimer = false;

            for (let participant of participants) {
                if (isArrayPopulated(participant.products)) {
                    for (let product of participant.products) {
                        registrants += this.getParticipantHtml(participant, product, false, true, true);
                        if (comps.indexOf(product.competitionName + product.organisationName) == -1) {
                            comps.push(product.competitionName + product.organisationName)
                            contacts += this.getContactsHtml(product);
                        }
                        if (orgs.indexOf(product.organisationName) == -1) {
                            orgs.push(product.organisationName)
                        }
                        if (participant.isInActive) {
                            showChildDisclaimer = true;
                        } else if (participant.user.id != participant.creator.id) {
                            others.push(participant.firstName + " " + participant.lastName);
                        }
                    }
                }
            }

            logger.info("--$###-- INVOICE RECEIVER: " + invoiceReciever);
            let subject = template.emailSubject;
            template.emailBody = template.emailBody.replace(EmailConstants.profileLink, process.env.USER_REGISTRATION_FORM_URL);

            if (showChildDisclaimer) {
                if (participant.creator.isInActive) {
                    registrants += AppConstants.childRegistererWithParentEmailNote;
                } else {
                    registrants += AppConstants.withParentEmailNote;
                }
            }
            if (!others || others.length == 0) {
                template.emailBody = template.emailBody.replace(EmailConstants.otherLoginsToReplace, '');
            } else {
                let otherMembersNote = '';
                if (others.length == 1) {
                    otherMembersNote = AppConstants.otherMemberNoteSingle;
                } else {
                    otherMembersNote = AppConstants.otherMemberNote;
                }
                otherMembersNote = otherMembersNote.replace(AppConstants.otherMemberPrefix, await this.separateWithAnd(others));
                template.emailBody = template.emailBody.replace(EmailConstants.otherLogins, otherMembersNote);
            }

            template.emailBody = template.emailBody.replace(EmailConstants.registrants, registrants);
            template.emailBody = template.emailBody.replace(EmailConstants.contacts, contacts);
            template.emailBody = template.emailBody.replace(EmailConstants.affiliateName, await this.separateWithAnd(orgs));

            let emailHtml = this.composeEmail(template.title, template.emailBody, participant.creator, password);

            // this.sendAndLogEmail(contact.email, contact.isInActive, contact.id, subject, emailHtml, "", 4, orgRegCreated.id, userId);

            await this.sendAndLogEmail(participant.creator.email, participant.creator.isInActive, userId, subject, emailHtml, password, 1, registrationId, participant.user.id);
        } catch (error) {
            logger.error(` ERROR occurred in individual mail ` + error);
            throw error;
        }
    }

    public async sendIndividualMailForTeamReg(
        participant: ParticipantRegistrationInfoDto,
        template: CommunicationTemplate,
        userId: number,
        userRegistrationId: number,
        fileName: string
    ) {
        try {
            let subject = template.emailSubject;
            let profileLink = process.env.USER_REGISTRATION_FORM_URL;

            template.emailBody = template.emailBody.replace(EmailConstants.competitionName, participant.products[0].competitionName);
            template.emailBody = template.emailBody.replace(EmailConstants.teamName, participant.teamName);

            let registrants = this.getParticipantHtml(participant, participant.products[0], false, true, false)
            template.emailBody = template.emailBody.replace(EmailConstants.registrants, registrants);

            let contacts = this.getContactsHtml(participant.products[0]);
            template.emailBody = template.emailBody.replace(EmailConstants.contacts, contacts);
            template.emailBody = template.emailBody.replace(EmailConstants.affiliateName, participant.products[0].organisationName);
            template.emailBody = template.emailBody.replace(EmailConstants.profileLink, profileLink);

            let emailHtml = this.composeEmail(template.title, template.emailBody, participant.user, null);
            await this.sendAndLogEmail(participant.user.email, participant.user.isInActive, userId, subject, emailHtml, null, 12, userRegistrationId, participant.user.id);
        } catch (error) {
            logger.error(` ERROR occurred in individual mail ` + error);
            throw error;
        }
    }

    public async sendMailToReferFriend(res, templateObj, userId, registrationId) {
        try {
            let subject = templateObj.emailSubject;
            let url = process.env.REGISTRATION_FORM_URL;
            let venue = null;
            if (isArrayPopulated(res.venue)) {
                venue = await this.separateWithAnd(res.venue);
            }
            //  let html = ``;
            //  url = url.replace(AppConstants.userRegUniquekey,playerBody.userRegUniqueKey)
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, res.name);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.competionName, res.competitionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.refererName, res.refererName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.division, res.divisionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.competionName, res.competitionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.startDate, res.startDate);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.endDate, res.endDate);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.venue, venue);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, res.organisationName);
            url = url.replace("{ORGANISATIONID}", res.organisationUniqueKey);
            url = url.replace("{COMPETITIONID}", res.competitionUniqueKey);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.url, url);

            await this.sendAndLogEmail(res.email, res.isInActive, res.userId, subject, templateObj.emailBody, null, 5, res.friendId, userId);
        } catch (error) {
            logger.error(` ERROR occurred in individual mail ` + error);
            throw error;
        }
    }

    public async sendInstalmentMail(fileName, item, templateObj, futureInstalments, currentInstalment, userInfo, memberInfo) {
        try {
            let url = "#";
            let subject = templateObj.emailSubject;

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.member, memberInfo.firstName + " " + memberInfo.lastName);

            let today = new Date();
            let responseDate = moment(today).tz("Australia/Sydney").format('DD/MM/YYYY');
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, userInfo.firstName + ' ' + userInfo.lastName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.member, memberInfo.firstName + ' ' + memberInfo.lastName);
            if (item.teamName == null) {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.forTeamTeamName, '');
            }
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.teamName, item.teamName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.competionName, item.competitionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.division, item.divisionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.or, '');
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.playerCouchUmpire, item.membershipTypeName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.startDate, item.startDate);
            let str = "";
            if (currentInstalment != null) {
                str += "<li>";
                str += AppConstants.date;
                str += " - $";
                str += AppConstants.amount;
                str += "</li>";
                str = str.replace(AppConstants.date, responseDate);
                str = str.replace(AppConstants.amount, currentInstalment.toFixed(2));
            }
            if (isArrayPopulated(futureInstalments)) {
                for (let fi of futureInstalments) {
                    str += "<li>";
                    str += AppConstants.date;
                    str += " - $";
                    str += AppConstants.amount;
                    str += "</li>";

                    str = str.replace(AppConstants.date, fi.date);
                    str = str.replace(AppConstants.amount, fi.amount.toFixed(2));
                }
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.finalPayment, "");
            } else {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.yourPaymentIsDue, "");
            }
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.dateAndAmount, str);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.url, url);

            await this.sendAndLogEmail(userInfo.email, userInfo.isInActive, userInfo.id, subject, templateObj.emailBody, null, 7, item.invoiceId, userInfo.id);
        } catch (error) {
            throw error;
        }
    }

    public async sendDeRegisterMail(userObj: User, templateObj, userId, orgList, organisation: Organisation, compOrgName, amount, deRegisterId, isDecline) {
        try {
            let subject = templateObj.emailSubject;
            amount = parseFloat(amount).toFixed(2);
            // let html = ``;
            // url = url.replace(AppConstants.userRegUniquekey,playerBody.userRegUniqueKey)
            if (organisation.phoneNo == null || organisation.phoneNo == "") {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateNameOn, AppConstants.affiliateName);
            }
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, userObj.firstName + " " + userObj.lastName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.amount, "$" + amount);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, organisation.name);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.organisationPhone, organisation.phoneNo);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.compOrgName, compOrgName);
            if (isDecline == 0) {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.reason, "");
            }
            let str = "";
            for (let org of orgList) {
                str += "<tr>";
                str += "<td>";
                str += org.orgName;
                str += "</td>";
                str += "<td>";
                str += org.status != null && org.status != 0 ? "Declined" : "Approved";
                str += "</td>";
                if (isDecline != 0) {
                    str += "<td>";
                    str += org.status != null && org.status != 0 ? org.reason : "";
                    str += "</td>";
                }
                str += "</tr>";
            }

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.tableRows, str);

            await this.sendAndLogEmail(userObj.email, userObj.isInActive, userObj.id, subject, templateObj.emailBody, null, 13, deRegisterId, userId);
        } catch (error) {
            logger.error(` ERROR occurred in deregistration mail ` + error);
            throw error;
        }
    }

    public async sendTransferMail(userObj: User, templateObj, userId, organisationName, newOrganisation: Organisation, newCompetition, deRegisterId) {
        try {
            let subject = templateObj.emailSubject;

            // let html = ``;
            let url = process.env.REGISTRATION_FORM_URL;
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, userObj.firstName + " " + userObj.lastName);
            // templateObj.emailBody = templateObj.emailBody.replace(AppConstants.amount, '$' + amount);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.newAffiliate, newOrganisation.name);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.newAffiliate, newOrganisation.name);

            url = url.replace("{ORGANISATIONID}", newOrganisation.organisationUniqueKey);
            url = url.replace("{COMPETITIONID}", newCompetition.competitionUniqueKey);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.url, url);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, organisationName);

            await this.sendAndLogEmail(userObj.email, userObj.isInActive, userObj.id, subject, templateObj.emailBody, null, 13, deRegisterId, userId);
        } catch (error) {
            logger.error(` ERROR occurred in individual mail ` + error);
            throw error;
        }
    }

    public async sendRemoveMail(removeUserObj, templateObj, userId) {
        try {
            let subject = templateObj.emailSubject;

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, removeUserObj.userName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.teamName, removeUserObj.teamName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.competionName, removeUserObj.competitionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, removeUserObj.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.registerPersonName, removeUserObj.teamRegisteringPerson);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.registerPersonName, removeUserObj.teamRegisteringPerson);

            this.sendAndLogEmail(removeUserObj.email, removeUserObj.isInActive, removeUserObj.userId, subject, templateObj.emailBody, null, 14, removeUserObj.registrationId, userId);
        } catch (error) {
            logger.error(` ERROR occurred in remove mail ` + error);
            throw error;
        }
    }

    public async sendDirectDebitMailIndividual(
        template: CommunicationTemplate,
        creator: User,
        registrationId: number,
        userId: number,
        participant: ParticipantRegistrationInfoDto,
        registrationType: number
    ) {
        try {
            let registrants = '';
            let contacts = '';
            let comps: string[] = [];
            let orgs: string[] = [];

            if (isArrayPopulated(participant.products)) {
                for (let product of participant.products) {
                    registrants += this.getParticipantHtml(participant, product, false, true, true);
                    if (comps.indexOf(product.competitionName + product.organisationName) == -1) {
                        comps.push(product.competitionName + product.organisationName)
                        contacts += this.getContactsHtml(product);
                    }
                    if (orgs.indexOf(product.organisationName) == -1) {
                        orgs.push(product.organisationName)
                    }
                }
            }
            let subject = template.emailSubject;
            // template.emailBody = template.emailBody.replace(AppConstants.registerPersonName, participant.creator.firstName + " " + participant.creator.lastName);
            // template.emailBody = template.emailBody.replace(EmailConstants.profileLink, process.env.USER_REGISTRATION_FORM_URL);
            template.emailBody = template.emailBody.replace(EmailConstants.registrants, registrants);
            if (participant.creator.id != participant.user.id) {
                // let registrantContact = `<p><strong>${participant.creator.firstName} ${participant.creator.lastName}</strong></p>`;
                // template.emailBody = template.emailBody.replace(EmailConstants.contacts, registrantContact + contacts);
                let peopleToEmail = await this.separateWithAnd([AppConstants.youSentence, participant.firstName + " " + participant.lastName]);
                template.emailBody = template.emailBody.replace(AppConstants.emailYou, `${AppConstants.email} ${peopleToEmail}`);
            } else {
                template.emailBody = template.emailBody.replace(EmailConstants.contacts, contacts);
            }
            template.emailBody = template.emailBody.replace(EmailConstants.affiliateName, await this.separateWithAnd(orgs));

            let emailHtml = this.composeEmail(template.title, template.emailBody, participant.user, null);
            await this.sendAndLogEmail(creator.email, creator.isInActive, creator.id, subject, emailHtml, null, 1, registrationId, participant.creator.id);
        } catch (error) {
            logger.error(` ERROR occurred in individual mail ` + error);
            throw error;
        }
    }

    public async sendDirectDebitMailTeam(
        template: CommunicationTemplate,
        creator: User,
        registrationId: number,
        userId: number,
        participant: ParticipantRegistrationInfoDto,
        registrationType: number
    ) {
        let subject = template.emailSubject;
        try {
            let registrants = '';
            let contacts = '';
            let comps: string[] = [];
            let orgs: string[] = [];
            if (isArrayPopulated(participant.products)) {
                for (let product of participant.products) {
                    //registrants += this.getParticipantHtml(participant, product, false, true)
                    if (comps.indexOf(product.competitionName + product.organisationName) == -1) {
                        comps.push(product.competitionName + product.organisationName)
                        contacts += this.getContactsHtml(product);
                    }
                    // if (orgs.indexOf(product.organisationName) == -1) {
                    //     orgs.push(product.organisationName)
                    // }
                }
            }

            template.emailBody = template.emailBody.replace(EmailConstants.teamName, participant.teamName);
            //template.emailBody = template.emailBody.replace(AppConstants.colonAndDot, ".");
            template.emailBody = template.emailBody.replace(EmailConstants.competionStartDate, participant.products[0].startDate);
            template.emailBody = template.emailBody.replace(EmailConstants.contacts, contacts);
            template.emailBody = template.emailBody.replace(EmailConstants.affiliateName, participant.products[0].organisationName);
            template.emailBody = template.emailBody.replace(EmailConstants.competitionName, participant.products[0].competitionName);
            template.emailBody = template.emailBody.replace(EmailConstants.affiliateName, participant.products[0].organisationName);

            let emailHtml = this.composeEmail(template.title, template.emailBody, creator, null);
            await this.sendAndLogEmail(creator.email, creator.isInActive, creator.id, subject, emailHtml, null, 1, registrationId, userId);
        } catch (error) {
            throw error;
        }
    }

    private separateWithAnd(a) {
        let array = a.join(', ')
            .split('').reverse().join('')
            .replace(' ,', ' dna ')
            .split('').reverse().join('');
        return array;
    }

    private async sendAndLogEmail(
        targetEmail: string, isChild: number = 0, toUserId: number, subject: string, htmlBody: string,
        password: string, communicationType: number, entityId: number, creatorId: number
    ) {
        try {
            const toEmail = isChild == 1 ? getParentEmail(targetEmail) : targetEmail;
            const transporter = nodeMailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.MAIL_USERNAME, // generated ethereal user
                    pass: process.env.MAIL_PASSWORD, // generated ethereal password
                },
                tls: {
                    // do not fail on invalid certs
                    rejectUnauthorized: false,
                },
            });

            const mailOptions = {
                from: {
                    name: process.env.MAIL_FROM_NAME,
                    address: process.env.MAIL_FROM_ADDRESS,
                },
                to: toEmail,
                replyTo: "donotreply@worldsportaction.com",
                subject: subject,
                html: htmlBody,
            };

            if (Number(process.env.SOURCE_MAIL) == 1) {
                mailOptions.html = " To : " + mailOptions.to + "<br><br>" + mailOptions.html;
                mailOptions.to = process.env.TEMP_DEV_EMAIL;
            }

            let cTrack = new CommunicationTrack();
            cTrack.id = 0;
            cTrack.communicationType = communicationType;
            // cTrack.contactNumber = contact.mobileNumber
            cTrack.entityId = entityId;
            cTrack.deliveryChannelRefId = 1;
            cTrack.emailId = toEmail;
            cTrack.userId = toUserId;
            cTrack.subject = subject;
            if (isNotNullAndUndefined(password) && password.length > 1) {
                cTrack.content = mailOptions.html.replace(password, "******");
            } else {
                cTrack.content = htmlBody;
            }
            cTrack.createdBy = creatorId;

            // await
            transporter.sendMail(mailOptions, (err, info) => {
                if (err) {
                    cTrack.statusRefId = 2;
                    logger.error(`sendMail: {subject} : Mail error ${err},  ${toEmail}`);
                    this.insertIntoCommunicationTrack(cTrack);
                    // Here i commented the below code as the caller is not handling the promise reject
                    // return Promise.reject(err);
                } else {
                    cTrack.statusRefId = 1;
                    logger.info(`sendMail: {subject} : Mail sent successfully,  ${toEmail}`);
                    this.insertIntoCommunicationTrack(cTrack);
                }
                transporter.close();
                return Promise.resolve();
            });
        } catch (error) {
            throw error;
        }
    }

    private getParticipantHtml(
        participant: ParticipantRegistrationInfoDto,
        product: ParticipantRegistrationInfoProductDto,
        showChildIndicator: boolean,
        showUmpireNote: boolean,
        showMembershipType
    ): string {
        let registrants = '';
        let participantName = participant.firstName + ' ' + participant.lastName + (showChildIndicator == true && participant.isInActive ? '**' : '');
        registrants += `<tr><td align="left" valign="top" class="ind-left"><strong>${participantName}</strong></td>`;
        let productType = showMembershipType ? product.productTypeName : '';
        registrants += `<td align="right" valign="top" class="ind-right"><strong>${productType}</strong></td></tr>`;
        registrants += `<tr><td colspan="2" class="ind-subtext">${product.organisationName}<br/>`;
        registrants += `${product.competitionName} (starts ${product.startDate})`;
        if (showUmpireNote == true && product.productTypeName === AppConstants.umpire) {
            registrants += `<br/><br/>${AppConstants.umpireNote}`;
        }
        registrants += '</td></tr>';
        return registrants;
    }

    private getContactsHtml(product: ParticipantRegistrationInfoProductDto): string {
        let contacts = `<p><strong>${product.competitionName}</strong> - ${product.organisationName}`;
        if (isStringNullOrEmpty(product.replyName)) {
            contacts += ` - ${product.replyName}`;
        }
        if (isStringNullOrEmpty(product.replyRole)) {
            contacts += ` - ${product.replyRole}`;
        }
        let email = !isStringNullOrEmpty(product.replyEmail) ? product.replyEmail : product.organisationEmail;
        if (isStringNullOrEmpty(email)) {
            contacts += ` - <a href="mailto:${email}">${email}</a>`;
        }
        if (isStringNullOrEmpty(product.replyPhone)) {
            contacts += ` - <a href="tel:${product.replyPhone}">${product.replyPhone}</a>`;
        }
        contacts += '</p>';
        return contacts;
    }

    private composeEmail(title: string, content: string, toUser: User, password: string): string {
        let html =
            `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
            <html lang="pt-br" xmlns="http://www.w3.org/1999/xhtml">
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
                    <title>Netball Livescores</title>
                    <style type="text/css">
                        @import url('https://fonts.googleapis.com/css?family=Roboto:300,400,700,900');
                    </style>
                    <style type="text/css">
                        body { width: 100% !important; -webkit-font-smoothing: antialiased; }
                        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; padding:0; margin:0;  }
                        p { margin: 0; }
                        table td {border-collapse: collapse !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                        img { border:0; height:auto; outline:none; text-decoration:none; max-width:100%; }
                        table { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                        #outlook a {padding:0;}
                        body, td, th, p, div, li, a, span { 
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                        mso-line-height-rule: exactly;
                        }
                        
                        /*START DESKTOP STYLES*/
                        .container { width: 100%; max-width: 700px; margin: 0 auto; }
                        .d-b-padding-32 { padding-bottom: 32px; }
                        .d-t-padding-32 { padding-top: 32px; }
                        .d-b-padding-24 { padding-bottom: 24px; }
                        .d-title { font-family: Helvetica, Arial, sans-serif; color: #ffffff; font-size: 20px; mso-line-height-rule: exactly; line-height: 36px; padding: 20px 48px; }
                        .d-container-a { background-color: #FF8237; border-top-right-radius: 8px; border-top-left-radius: 8px; }
                        .d-container-b { background-color: #ffffff; padding: 36px 48px 0 48px }
                        .d-container-c { background-color: #ffffff; padding: 0px 48px 12px 48px; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; }
                        .d-b-padding-8 { padding-bottom: 8px; }
                        .d-b-padding-4 { padding-bottom: 4px; }
                        table .d-paragraph { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 16px; mso-line-height-rule: exactly; line-height: 24px; padding: 20px 0 20px 0; }
                        .d-paragraph span { color : #4c4c6d; }
                        .d-signature { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 20px; mso-line-height-rule: exactly; line-height: 32px; padding: 36px 0 32px 0; }
                        .d-hello { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 20px; font-weight: bold; mso-line-height-rule: exactly; line-height: 20px; }
    
                        .d-steps-table { padding: 16px; background-color: #fdfdfe; }
                        .d-steps-number { width: 48px; max-width: 48px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; color: #18BBFF; font-size: 32px; }
                        .d-steps-value { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 16px; mso-line-height-rule: exactly; line-height: 28px; }
                        .d-steps-value a { color: #FF8237; text-decoration: underline; }
    
                        .d-register-table { padding: 36px; background-color: #fdfdfe; }
                        .d-register-title { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 18px; mso-line-height-rule: exactly; line-height: 28px; }
                        .d-button { font-size: 20px }
    
                        .d-steps-number { width: 48px; max-width: 48px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; color: #18BBFF; font-size: 32px; }
                        .d-steps-value { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 16px; mso-line-height-rule: exactly; line-height: 28px; }
                        .d-steps-value a { color: #FF8237; text-decoration: underline; }
    
                        .d-team-table { border-top: 1px solid #EBF0F3; }
                        .d-team-name { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 12px; mso-line-height-rule: exactly; line-height: 32px; padding: 6px 0; border-bottom: 1px solid #EBF0F3; }
                        .d-team-role { font-family: Helvetica, Arial, sans-serif; color: #9B9BAD; font-size: 12px; mso-line-height-rule: exactly; line-height: 32px; padding: 6px 0; border-bottom: 1px solid #EBF0F3; }
    
                        .d-team-table { border-top: 1px solid #EBF0F3; }
                        .d-team-name { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 12px; mso-line-height-rule: exactly; line-height: 32px; padding: 6px 0; border-bottom: 1px solid #EBF0F3; }
                        .d-team-role { font-family: Helvetica, Arial, sans-serif; color: #9B9BAD; font-size: 12px; mso-line-height-rule: exactly; line-height: 32px; padding: 6px 0; border-bottom: 1px solid #EBF0F3; }
    
                        .d-paswd-table, .d-usr-table { padding: 16px 24px; background-color: #FDFDFE; }
                        .d-paswd-icon, .d-usr-icon { width: 32px; max-width: 32px; font-family: Helvetica, Arial, sans-serif; font-weight: bold; color: #18BBFF; font-size: 32px; }
                        .d-paswd-title, .d-usr-title { font-family: Helvetica, Arial, sans-serif; color: #9B9BAD; font-size: 14px; mso-line-height-rule: exactly; line-height: 18px; }
                        .d-paswd-value, .d-usr-value { font-family: Helvetica, Arial, sans-serif; color: #FF8237; font-size: 14px; mso-line-height-rule: exactly; line-height: 32px; padding-bottom: 20px}
                        .d-paswd-value a, .d-usr-value a { color: #FF8237; text-decoration: none; }
    
                        .ind-left { font-family: Helvetica, Arial, sans-serif; color: #4C4C6D; font-size: 16px; mso-line-height-rule: exactly; line-height: 24px; padding: 6px 0 0;  }
                        .ind-right { font-family: Helvetica, Arial, sans-serif; color: #9B9BAD; font-size: 16px; mso-line-height-rule: exactly; line-height: 24px; padding: 6px 0 0;  }
                        .ind-subtext { font-family: Helvetica, Arial, sans-serif;  font-size: 14px; mso-line-height-rule: exactly; line-height: 20px; padding: 6px 0 12px; border-bottom: 1px solid #EBF0F3; }
    
                        /*END DESKTOP STYLES*/
    
                        .tp-body { background-color: #EBF0F3; }
                        .specialLinks a, .d-contacts a { color:#FF8237; text-decoration: none;}
                        .click-to-action {
                            width: 100%;
                            margin: 32px 0;
                        }
                        .click-to-action a.d-button { color: #FFFFFF; }
                        .click-to-action .btn a { color: #ffffff; text-decoration: none; font-family: Helvetica, Arial, sans-serif; color: #ffffff; font-weight: bold; padding: 20px 32px; border-radius: 6px; background: #FF8237; } 
                        .d-contacts {
                            padding: 12px 12px;
                            margin: 12px 0 24px;
                            background-color: #f6f6f6;
                            mso-line-height-rule: exactly;
                            line-height: 20px;
                            font-size: 14px;
                        }
                        .d-contacts p {
                            margin-bottom: 6px;
                            color: #4c4c6d;
                        }
                        
                        @media screen and (min-width: 421px) and (max-width: 700px) {
                            .container { width: 100% !important; }
                        }
                        
                        @media only screen and (max-width:420px) {
                            img.inline { display: inline !important; }
                            img.m-full { width: 100% !important; max-width: 100% !important; }
                            table.m-center { margin: 0 auto !important; }
                            td.m-hide, tr.m-hide { display: none !important; }
                            td.m-center { text-align:center !important; }
                            td.m-left { text-align:left !important; }
                            td.m-right { text-align:right !important; }
                            td.coll { display:block !important; width:100% !important; }
                            td.rt-padding { padding-right: 20px !important; }
                            td.nrt-padding { padding-right: 0 !important; }
                            td.lt-padding { padding-left: 20px !important; }
                            td.nlt-padding { padding-left: 0 !important; }
                            td.l-padding { padding-left: 20px !important; padding-right: 20px !important; }   
                            td.nl-padding { padding-left: 0 !important; padding-right: 0 !important; }
                            td.b-padding { padding-bottom: 20px !important; }
                            td.nb-padding { padding-bottom: 0 !important; }
                            td.t-padding { padding-top: 20px !important; }
                            td.nt-padding { padding-top: 0 !important; }
                            .m-txt { font-size: 16px !important; line-height: 24px !important; }
                            td.d-container-a { border-top-right-radius: 0px; border-top-left-radius: 0px; }
                            td.d-container-c { border-bottom-left-radius: 0px; border-bottom-right-radius: 0px; }
                        }		
                        @media screen and (max-width: 420px) {
                            u ~ div {
                                min-width: 95vw;
                            }
                        }	
                    </style>
                    <!--[if (gte mso 9)|(IE)]>
                        <style type="text/css">
                            td, a, div, span, p { font-family: Helvetica, Arial, sans-serif !important; }
                        </style>    
                    <![endif]-->
                </head>
                <body class="tp-body">
                    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="table-layout:fixed;" class="tp-body">
                        <tr>
                            <td align="center" valign="top" class="tp-body d-b-padding-32 d-t-padding-32 nb-padding nt-padding">
                                <!--[if (gte mso 9)|(IE)]>
                                <table width="700"  style="background-color: #FFFFFF" align="center" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td align="center" valign="top">
                                            <![endif]-->
                                                <table cellpadding="0" cellspacing="0" border="0" align="center" class="container">`;

        if (isNotNullAndUndefined(title) && title.length > 0) {
            let headerHtml = `
                                                    <tr>
                                                        <td align="center" valign="top" class="d-container-a">
                                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                                <tr>
                                                                    <td align="left" valign="top" class="d-title l-padding">
                                                                        $(title)
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>`;
            html += headerHtml.replace('$(title)', title);
        }


        let passwordHtml = '';
        if (isNotNullAndUndefined(password) && password.length > 0) {
            let parentsLogin = (toUser.isInActive == 1) ? AppConstants.parentsLogin : '';
            passwordHtml = `
                                                    <tr>
                                                        <td align="center" valign="top" class="d-b-padding-4">
                                                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                                <tr>
                                                                    <td align="left" valign="middle" class="d-usr-title">USERNAME ${parentsLogin}</td>
                                                                </tr>
                                                                <tr>
                                                                    <td align="left" valign="top" class="d-usr-value m-txt">
                                                                        <strong>$(username)</strong>
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td align="left" valign="middle" class="d-usr-title">PASSWORD</td>
                                                                </tr>
                                                                <tr>
                                                                    <td align="left" valign="top" class="d-usr-value m-txt">
                                                                        <strong>$(password)</strong>
                                                                    </td>
                                                                </tr>
                                                            </table>
														</td>
													</tr>`;
            passwordHtml = passwordHtml.replace('$(username)', toUser.email);
            passwordHtml = passwordHtml.replace('$(password)', password);
        }

        html += `
                                                    <tr>
                                                        <td class="d-hello d-container-b l-padding t-padding">
                                                            Hi $(addressee)
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="left" valign="top" class="d-container-c l-padding b-padding">
                                                        $(content)
                                                        </td>
                                                    </tr>
                                                </table>
                                            <!--[if (gte mso 9)|(IE)]>
                                        </td>
                                    </tr>
                                </table>
                                <![endif]--> 
                            </td>
                        </tr>
                    </table>
                </body>
            </html>`;

        html = html.replace('$(addressee)', toUser.firstName + " " + toUser.lastName + ",");
        html = html.replace('$(content)', content);
        html = html.replace(EmailConstants.credentials, passwordHtml);

        return html;
    }
}
