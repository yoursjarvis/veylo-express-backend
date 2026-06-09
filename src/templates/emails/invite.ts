export type InviteEmailData = {
  inviteUrl: string;
  organizationName: string;
  role: string;
};

export const inviteEmail = (data: InviteEmailData) => {
  return {
    subject: `You have been invited to join ${data.organizationName}`,
    html: `
      <p>Hello,</p>
      <p>You have been invited to join <strong>${data.organizationName}</strong> as a ${data.role}.</p>
      <p><a href="${data.inviteUrl}">Click here to accept the invitation</a></p>
    `,
  };
};
