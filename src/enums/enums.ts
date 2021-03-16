enum ShopPaymentStatus {
    Paid = 'Paid',
    RefundFullAmount = 'Refund Full Amount',
    RefundPartialAmount = 'Refund Partial Amount',
    PickedUp = 'Picked up',
    Shipped = 'Shipped'
}

enum ShopDeliveryType {
    Pickup = 'pickup',
    Shipping = 'shipping'
}

enum PaymentMethod {
    CreditCard = "Credit Card",
    DirectDebit = "Direct debit"
}

  export enum RegistrationStep {
    RegistrationTrackStep = 2,
    FutureInstalmentTrackStep = 14, 
    TeamInviteTrackStep = 12,
    InstalmentTrackStep = 16, 
    TeamInviteInstalmentTrackStep = 15,
    TeamInviteSuccessTrackStep = 13,
    PerMatchFeeTrackStep = 17,
    TeamMemberRegistrationTrackStep = 18,
    NegativeFeeTrackStep =  19,
    HardshipFeeTrackStep =  20,
    DiscountFeeTrackStep = 21
  }

export enum DiscountType {
    Amount = 1,
    Percentage = 2
}


export enum RegisteringYourself {
    SELF = 1,
    CHILD = 2,
    OTHER = 3,
    TEAM = 4
}

export enum FinanceFeeType {
    Membership = 1,
    Nomination = 2,
    Competition = 3,
    Charity = 4,
    Shop = 5,
    AffiliateNomination = 6,
    AffiliateCompetition = 7
  }

  export enum TransactionTypeRefId {
    Deregistration = 1,
    Registration = 2,
    PartialRefund = 3,
    Discount = 4,
    NegativeFee = 5,
    HardshipFee = 6,
    GovernmentVoucher = 7
  }

  export enum RegistrationChangeType {
    DeRegister = 1,
    Transfer = 2
  }

  export enum InvoicePaymentStatus{
    Initiated = 'initiated',
    Pending = 'pending',
    Success = 'success',
    Failed = 'failed'
  }

  export enum TransactionStatus {
    Draft = 1,
    Success = 2,
    Processing = 3, 
    Failed = 6,
    Deregistered = 7
  }

  export enum RegPaymentOptionRef{
    SingleGame = 1,
    SeasonalFull = 3,
    Instalment = 4,
    SchoolInvoice = 5
  }