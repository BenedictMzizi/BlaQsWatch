
import { supabase } from '../lib/supabase';

function throwIfError(error) {
  if (error) throw error;
}

export async function getCompanyMembers(businessId, currentUserId) {
  const { data: memberships, error: membershipError } = await supabase
    .from('business_members')
    .select('user_id, role')
    .eq('business_id', businessId)
    .eq('active', true);

  throwIfError(membershipError);

  const userIds = (memberships || [])
    .map(item => item.user_id)
    .filter(id => id !== currentUserId);

  if (!userIds.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, active')
    .in('id', userIds)
    .eq('active', true)
    .order('full_name');

  throwIfError(profileError);

  return (profiles || []).map(profile => ({
    ...profile,
    membershipRole:
      memberships.find(item => item.user_id === profile.id)?.role || 'staff'
  }));
}

async function getUnreadCount(conversationId, userId, lastReadAt) {
  if (!lastReadAt) return 0;

  const { count, error } = await supabase
    .from('conversation_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .gt('created_at', lastReadAt);

  throwIfError(error);

  return count || 0;
}

export async function getConversationList({
  businessId = null,
  supportOnly = false,
  currentUserId
}) {
  let query = supabase
    .from('conversations')
    .select(`
      id,
      business_id,
      conversation_type,
      title,
      created_by,
      support_status,
      last_message_at,
      last_message_preview,
      created_at,
      updated_at
    `)
    .order('last_message_at', {
      ascending: false,
      nullsFirst: false
    });

  if (supportOnly) {
    query = query.eq('conversation_type', 'support');
  } else {
    query = query.eq('business_id', businessId);
  }

  const { data: conversations, error } = await query;

  throwIfError(error);

  if (!conversations?.length) return [];

  const conversationIds = conversations.map(item => item.id);

  const { data: participants, error: participantError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, last_read_at')
    .in('conversation_id', conversationIds);

  throwIfError(participantError);

  const profileIds = [
    ...new Set([
      ...conversations.map(item => item.created_by),
      ...(participants || []).map(item => item.user_id)
    ])
  ];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', profileIds);

  throwIfError(profileError);

  const profileMap = new Map(
    (profiles || []).map(profile => [profile.id, profile])
  );

  let businessMap = new Map();

  if (supportOnly) {
    const businessIds = [
      ...new Set(conversations.map(item => item.business_id))
    ];

    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id, name')
      .in('id', businessIds);

    throwIfError(businessError);

    businessMap = new Map(
      (businesses || []).map(business => [business.id, business.name])
    );
  }

  const results = await Promise.all(
    conversations.map(async conversation => {
      const conversationParticipants = (participants || []).filter(
        item => item.conversation_id === conversation.id
      );

      const ownParticipant = conversationParticipants.find(
        item => item.user_id === currentUserId
      );

      const unreadCount = ownParticipant
        ? await getUnreadCount(
            conversation.id,
            currentUserId,
            ownParticipant.last_read_at
          )
        : 0;

      return {
        ...conversation,
        participants: conversationParticipants.map(item => ({
          ...item,
          profile: profileMap.get(item.user_id) || null
        })),
        unread_count: unreadCount,
        business_name: businessMap.get(conversation.business_id) || null,
        creator: profileMap.get(conversation.created_by) || null
      };
    })
  );

  return results;
}

export async function getConversationMessages(conversationId) {
  const { data: messages, error } = await supabase
    .from('conversation_messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      message_type,
      created_at
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  throwIfError(error);

  if (!messages?.length) return [];

  const senderIds = [...new Set(messages.map(item => item.sender_id))];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', senderIds);

  throwIfError(profileError);

  const profileMap = new Map(
    (profiles || []).map(profile => [profile.id, profile])
  );

  return messages.map(message => ({
    ...message,
    sender: profileMap.get(message.sender_id) || null
  }));
}

export async function getConversationParticipants(conversationId) {
  const { data: participants, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id, last_read_at, created_at')
    .eq('conversation_id', conversationId);

  throwIfError(error);

  if (!participants?.length) return [];

  const userIds = participants.map(item => item.user_id);

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .in('id', userIds);

  throwIfError(profileError);

  const profileMap = new Map(
    (profiles || []).map(profile => [profile.id, profile])
  );

  return participants.map(item => ({
    ...item,
    profile: profileMap.get(item.user_id) || null
  }));
}

export async function createConversation({
  businessId,
  creatorId,
  type = 'internal',
  title,
  participantIds = [],
  initialMessage
}) {
  const conversationTitle = title?.trim() || null;

  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      business_id: businessId,
      conversation_type: type,
      title: conversationTitle,
      created_by: creatorId,
      support_status: type === 'support' ? 'open' : null
    })
    .select()
    .single();

  throwIfError(error);

  const uniqueParticipantIds = [
    ...new Set(participantIds.filter(id => id && id !== creatorId))
  ];

  if (uniqueParticipantIds.length) {
    const { error: participantError } = await supabase
      .from('conversation_participants')
      .insert(
        uniqueParticipantIds.map(userId => ({
          conversation_id: conversation.id,
          user_id: userId,
          added_by: creatorId
        }))
      );

    throwIfError(participantError);
  }

  if (initialMessage?.trim()) {
    await sendMessage({
      conversationId: conversation.id,
      senderId: creatorId,
      content: initialMessage
    });
  }

  return conversation;
}

export async function ensureConversationParticipant(
  conversationId,
  userId
) {
  const { error } = await supabase
    .from('conversation_participants')
    .upsert(
      {
        conversation_id: conversationId,
        user_id: userId,
        added_by: userId,
        last_read_at: new Date().toISOString()
      },
      {
        onConflict: 'conversation_id,user_id',
        ignoreDuplicates: true
      }
    );

  throwIfError(error);
}

export async function sendMessage({
  conversationId,
  senderId,
  content
}) {
  const cleanContent = content?.trim();

  if (!cleanContent) {
    throw new Error('Please enter a message.');
  }

  const { data, error } = await supabase
    .from('conversation_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: cleanContent
    })
    .select()
    .single();

  throwIfError(error);

  return data;
}

export async function markConversationRead(conversationId, userId) {
  const { error } = await supabase
    .from('conversation_participants')
    .update({
      last_read_at: new Date().toISOString()
    })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  throwIfError(error);
}

export async function updateSupportStatus(conversationId, status) {
  const allowedStatuses = [
    'open',
    'in_progress',
    'waiting_for_company',
    'resolved'
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error('Invalid support status.');
  }

  const { error } = await supabase
    .from('conversations')
    .update({ support_status: status })
    .eq('id', conversationId)
    .eq('conversation_type', 'support');

  throwIfError(error);
}
