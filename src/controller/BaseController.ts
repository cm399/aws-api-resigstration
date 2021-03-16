import admin from "firebase-admin";
import { Inject } from "typedi";
import CompetitionDivisionService from "../services/CompetitionDivisionService";
import CompetitionLogoService from "../services/CompetitionLogoService";
import FriendService from "../services/FriendService";
import InvoiceService from "../models/registrations/InvoiceService";
import MembershipProductService from "../models/registrations/MembershipProductService";
import OrgRegistrationParticipantService from "../services/OrgRegistrationParticipantService";
import { User } from "../models/security/User";
import ActionsService from "../services/ActionsService";
import AffiliateService from "../services/AffiliateService";
import ApprovalRefundService from "../services/ApprovalRefundService";
import ApprovalService from "../services/ApprovalService";
import CommunicationTemplateService from "../services/CommunicationTemplateService";
import CommunicationTrackService from "../services/CommunicationTrackService";
import CompetitionCharityRoundUpService from "../services/CompetitionCharityRoundUpService";
import CompetitionDivisionGradeService from "../services/CompetitionDivisionGradeService";
import CompetitionGovernmentVoucherService from "../services/CompetitionGovernmentVoucherService";
import CompetitionMembershipProductDivisionService from "../services/CompetitionMembershipProductDivisionService";
import CompetitionMembershipProductFeeService from "../services/CompetitionMembershipProductFeeService";
import CompetitionMembershipProductService from "../services/CompetitionMembershipProductService";
import CompetitionMembershipProductTypeService from "../services/CompetitionMembershipProductTypeService";
import CompetitionNonPlayingDatesService from "../services/CompetitionNonPlayingDatesService";
import CompetitionPaymentInstalmentService from "../services/CompetitionPaymentInstalmentService";
import CompetitionPaymentMethodService from "../services/CompetitionPaymentMethodService";
import CompetitionPaymentOptionService from "../services/CompetitionPaymentOptionService";
import CompetitionRegistrationInviteesOrgService from "../services/CompetitionRegistrationInviteesOrgService";
import CompetitionRegistrationInviteesService from "../services/CompetitionRegistrationInviteesService";
import CompetitionRegService from "../services/CompetitionRegService";
import CompetitionTypeChildDiscountService from "../services/CompetitionTypeChildDiscountService";
import CompetitionTypeDiscountService from "../services/CompetitionTypeDiscountService";
import CompetitionTypeDiscountTypeService from "../services/CompetitionTypeDiscountTypeService";
import CompetitionVenueService from "../services/CompetitionVenueService";
import DeRegistrationService from "../services/DeRegistrationService";
import HomeDashboardService from "../services/HomeDashboardService";
import MembershipCapProductService from "../services/MembershipCapProductService";
import MembershipCapService from "../services/MembershipCapService";
import MembershipFeeCapService from "../services/MembershipFeeCapService";
import MembershipProductFeesService from "../services/MembershipProductFeesService";
import MembershipProductTypeChildDiscountService from "../services/MembershipProductTypeChildDiscountService";
import MembershipProductTypeDiscountService from "../services/MembershipProductTypeDiscountService";
import MembershipProductTypeDiscountTypeService from "../services/MembershipProductTypeDiscountTypeService";
import MembershipProductTypeMappingService from "../services/MembershipProductTypeMappingService";
import MembershipProductTypeService from "../services/MembershipProductTypeService";
import NonPlayerService from "../services/NonPlayerService";
import OrganisationLogoService from "../services/OrganisationLogoService";
import OrganisationService from "../services/OrganisationService";
import OrgRegistrationDisclaimerLinkService from "../services/OrgRegistrationDisclaimerLinkService";
import OrgRegistrationHardshipCodeService from "../services/OrgRegistrationHardshipCodeService";
import OrgRegistrationMembershipProductTypeService from "../services/OrgRegistrationMembershipProductTypeService";
import OrgRegistrationParticipantDraftService from "../services/OrgRegistrationParticipantDraftService";
import OrgRegistrationRegisterMethodService from "../services/OrgRegistrationRegisterMethodService";
import OrgRegistrationService from "../services/OrgRegistrationService";
import OrgRegistrationSettingsService from "../services/OrgRegistrationSettingsService";
import Player1Service from "../services/PlayerService";
import RegistrationService from "../services/RegistrationService";
import RegistrationTrackService from "../services/RegistrationTrackService";
import FirebaseService from "../services/security/FirebaseService";
import UserRoleEntityService from "../services/security/UserRoleEntityService";
import UserService from "../services/security/UserService";
import CartService from "../services/shop/CartService";
import OrderGroupService from "../services/shop/OrderGroupService";
import OrderService from "../services/shop/OrderService";
import SellProductService from "../services/shop/SellProductService";
import SKUService from "../services/shop/SKUService";
import TeamService from "../services/TeamService";
import TransactionAuditService from "../services/TransactionAuditService";
import TransactionService from "../services/TransactionService";
import PayoutTransactionService from "../services/PayoutTransactionService";
import UserMembershipExpiryService from "../services/UserMembershipExpiryService";
import UserRegistrationDraftService from "../services/UserRegistrationDraftService";
import UserRegistrationService from "../services/UserRegistrationService";
import { isNullOrEmpty } from "../utils/Utils";
import SingleGameRedeemService from "../services/SingleGameRedeemService";

export class BaseController {

    @Inject()
    protected firebaseService: FirebaseService;

    @Inject()
    protected ureService: UserRoleEntityService;

    @Inject()
    protected affiliateService: AffiliateService;

    @Inject()
    protected actionsService: ActionsService;

    @Inject()
    protected player1Service: Player1Service;

    @Inject()
    protected teamService: TeamService;

    @Inject()
    protected nonPlayerService: NonPlayerService;

    @Inject()
    protected friendService: FriendService;

    @Inject()
    protected userService: UserService;

    @Inject()
    protected communicationTrackService: CommunicationTrackService;

    @Inject()
    protected membershipProductService: MembershipProductService;

    @Inject()
    protected competitionDivisionGradeService: CompetitionDivisionGradeService;

    @Inject()
    protected membershipProductFeesService: MembershipProductFeesService;

    @Inject()
    protected membershipProductTypeService: MembershipProductTypeService;

    @Inject()
    protected membershipProductTypeChildDiscountService: MembershipProductTypeChildDiscountService;

    @Inject()
    protected membershipProductTypeDiscountService: MembershipProductTypeDiscountService;

    @Inject()
    protected membershipProductTypeDiscountTypeService: MembershipProductTypeDiscountTypeService;

    @Inject()
    protected membershipProductTypeMappingService: MembershipProductTypeMappingService;

    @Inject()
    protected competitionCharityRoundUpService: CompetitionCharityRoundUpService;

    @Inject()
    protected competitionGovernmentVoucherService: CompetitionGovernmentVoucherService;

    @Inject()
    protected competitionLogoService: CompetitionLogoService;

    @Inject()
    protected competitionMembershipProductService: CompetitionMembershipProductService;

    @Inject()
    protected competitionMembershipProductDivisionService: CompetitionMembershipProductDivisionService;

    @Inject()
    protected competitionMembershipProductFeeService: CompetitionMembershipProductFeeService;

    @Inject()
    protected competitionDivisionService: CompetitionDivisionService;

    @Inject()
    protected competitionMembershipProductTypeService: CompetitionMembershipProductTypeService;

    @Inject()
    protected competitionNonPlayingDatesService: CompetitionNonPlayingDatesService;

    @Inject()
    protected competitionPaymentOptionService: CompetitionPaymentOptionService;

    @Inject()
    protected competitionRegistrationInviteesService: CompetitionRegistrationInviteesService;

    @Inject()
    protected competitionRegistrationInviteesOrgService: CompetitionRegistrationInviteesOrgService;

    @Inject()
    protected competitionTypeChildDiscountService: CompetitionTypeChildDiscountService;

    @Inject()
    protected competitionTypeDiscountService: CompetitionTypeDiscountService;

    @Inject()
    protected competitionTypeDiscountTypeService: CompetitionTypeDiscountTypeService;

    @Inject()
    protected competitionVenueService: CompetitionVenueService;

    @Inject()
    protected organisationService: OrganisationService;

    @Inject()
    protected orgRegistrationService: OrgRegistrationService;

    @Inject()
    protected orgRegistrationDisclaimerLinkService: OrgRegistrationDisclaimerLinkService;

    @Inject()
    protected orgRegistrationHardshipCodeService: OrgRegistrationHardshipCodeService;

    @Inject()
    protected orgRegistrationMembershipProductTypeService: OrgRegistrationMembershipProductTypeService;

    @Inject()
    protected orgRegistrationRegisterMethodService: OrgRegistrationRegisterMethodService;

    @Inject()
    protected orgRegistrationSettingsService: OrgRegistrationSettingsService;
    @Inject()
    protected competitionRegService: CompetitionRegService;

    @Inject()
    protected organisationLogoService: OrganisationLogoService;

    @Inject()
    protected registrationService: RegistrationService;

    @Inject()
    protected orgRegistrationParticipantService: OrgRegistrationParticipantService;

    @Inject()
    protected userRegistrationService: UserRegistrationService;

    @Inject()
    protected communicationTemplateService: CommunicationTemplateService;

    @Inject()
    protected homeDashboardService: HomeDashboardService;

    @Inject()
    protected invoiceService: InvoiceService;

    @Inject()
    protected transactionService: TransactionService;

    @Inject()
    protected payoutTransactionService: PayoutTransactionService;

    @Inject()
    protected competitionPaymentInstalmentService: CompetitionPaymentInstalmentService;

    @Inject()
    protected registrationTrackService: RegistrationTrackService;

    @Inject()
    protected userRegistrationDraftService: UserRegistrationDraftService;

    @Inject()
    protected orgRegistrationParticipantDraftService: OrgRegistrationParticipantDraftService;

    @Inject()
    protected deRegisterService: DeRegistrationService;

    @Inject()
    protected approvalService: ApprovalService;

    @Inject()
    protected userMembershipExpiryService: UserMembershipExpiryService;

    @Inject()
    protected approvalRefundService: ApprovalRefundService;

    @Inject()
    protected orderGroupService: OrderGroupService;

    @Inject()
    protected cartService: CartService;

    @Inject()
    protected orderService: OrderService;

    @Inject()
    protected sellProductService: SellProductService;

    @Inject()
    protected skuService: SKUService;

    @Inject()
    protected competitionPaymentMethodService: CompetitionPaymentMethodService;

    @Inject()
    protected transactionAuditService: TransactionAuditService;

    @Inject()
    protected membershipCapService: MembershipCapService;

    @Inject()
    protected membershipCapProductService: MembershipCapProductService;

    @Inject()
    protected membershipFeeCapService: MembershipFeeCapService;

    @Inject()
    protected singleGameRedeemService: SingleGameRedeemService;

    protected async updateFirebaseData(user: User, password: string) {
        user.password = password;

        let fbUser;
        /// If there an existing firebaseUID get the firebase user via that
        if (!isNullOrEmpty(user.firebaseUID)) {
          fbUser = await this.firebaseService.loadUserByUID(user.firebaseUID);
        } else {
          /// Also we will check once if there an user alreay with that email
          /// in-order to make sure we don't call create of firebase user
          /// with an already existing email.
          fbUser = await this.firebaseService.loadUserByEmail(user.email);
          if (fbUser && fbUser.uid) {
            user.firebaseUID = fbUser.uid;
          }
        }

        if (!fbUser || !fbUser.uid) {
            fbUser = await this.firebaseService.createUser(
                user.email.toLowerCase(),
                password
            );
        } else {
            if (user && isNullOrEmpty(user.firebaseUID)) {
                fbUser = await this.firebaseService.createUser(
                    user.email.toLowerCase(),
                    password
                );
            } else if (user) {
                fbUser = await this.firebaseService.updateUserByUID(
                    user.firebaseUID,
                    user.email.toLowerCase(),
                    user.password
                );
            }
        }
        if (fbUser && fbUser.uid) {
            user.firebaseUID = fbUser.uid;
            await User.save(user);
        }
        await this.checkFirestoreDatabase(user, true);
    }

    protected async checkFirestoreDatabase(user, update = false) {
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
        } else if (update) {
          usersCollectionRef.doc(user.firebaseUID).update({
            'email': user.email.toLowerCase(),
            'firstName': user.firstName,
            'lastName': user.lastName,
            'uid': user.firebaseUID,
            'avatar': (user.photoUrl != null && user.photoUrl != undefined) ?
                user.photoUrl :
                null,
            'updated_at': admin.firestore.FieldValue.serverTimestamp(),
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
}
