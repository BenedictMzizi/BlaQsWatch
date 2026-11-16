import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../components/layout/DashboardLayout';
import { supabase } from '../../lib/supabase';

import {
  createConversation,
  getCompanyMembers,
  getConversationList,
  getConversationMessages,
  markConversationRead,
  sendMessage
} from '../../services/messagingService';

import '../../styles/Messages.css';

import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
  LifebuoyIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

function formatTime(value) {
  if (!value) return '';

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatConversationDate(value) {
  if (!value) return '';

  const date = new Date(value);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return formatTime(value);
  }

  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short'
  });
}

export default function Messages() {
  const {
    user,
    profile,
    selectedBusiness,
    selectedBusinessId,
    loading: workspaceLoading
  } = useWorkspace();

  const [conversations, setConversations] = useState([]);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);

  const [selectedConversation, setSelectedConversation] = useState(null);

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [newType, setNewType] = useState('internal');
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);

  const currentUserId = user?.id;

  const loadConversations = useCallback(async () => {
    if (!selectedBusinessId || !currentUserId) return;

    const result = await getConversationList({
      businessId: selectedBusinessId,
      currentUserId
    });

    setConversations(result);

    setSelectedConversation(current => {
      if (!current) return null;

      return result.find(item => item.id === current.id) || null;
    });
  }, [selectedBusinessId, currentUserId]);

  const loadMembers = useCallback(async () => {
    if (!selectedBusinessId || !currentUserId) return;

    const result = await getCompanyMembers(
      selectedBusinessId,
      currentUserId
    );

    setMembers(result);
  }, [selectedBusinessId, currentUserId]);

  const loadMessages = useCallback(async conversationId => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);

    try {
      const result = await getConversationMessages(conversationId);
      setMessages(result);
    } catch (loadError) {
      console.error('Unable to load messages:', loadError);
      setError(loadError.message || 'Unable to load messages.');
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (workspaceLoading || !selectedBusinessId || !currentUserId) {
      return;
    }

    let active = true;

    async function initialise() {
      setLoading(true);
      setError('');

      try {
        const [conversationResult, memberResult] = await Promise.all([
          getConversationList({
            businessId: selectedBusinessId,
            currentUserId
          }),
          getCompanyMembers(selectedBusinessId, currentUserId)
        ]);

        if (!active) return;

        setConversations(conversationResult);
        setMembers(memberResult);
      } catch (loadError) {
        console.error('Messaging initialisation failed:', loadError);

        if (active) {
          setError(
            loadError.message || 'Unable to load your messages.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialise();

    return () => {
      active = false;
    };
  }, [workspaceLoading, selectedBusinessId, currentUserId]);

  useEffect(() => {
    if (!selectedBusinessId) return undefined;

    const channel = supabase
      .channel(`company-messages-${selectedBusinessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_messages'
        },
        async payload => {
          const conversationId =
            payload.new?.conversation_id ||
            payload.old?.conversation_id;

          if (conversationId === selectedConversation?.id) {
            await loadMessages(conversationId);
          }

          try {
            await loadConversations();
          } catch (refreshError) {
            console.error('Unable to refresh conversations:', refreshError);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `business_id=eq.${selectedBusinessId}`
        },
        loadConversations
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    selectedBusinessId,
    selectedConversation?.id,
    loadMessages,
    loadConversations
  ]);

  useEffect(() => {
    if (!selectedConversation || !currentUserId) {
      setMessages([]);
      return;
    }

    let active = true;

    async function openConversation() {
      setError('');

      try {
        await markConversationRead(
          selectedConversation.id,
          currentUserId
        );

        const result = await getConversationMessages(
          selectedConversation.id
        );

        if (active) {
          setMessages(result);
          await loadConversations();
        }
      } catch (loadError) {
        console.error('Unable to open conversation:', loadError);

        if (active) {
          setError(loadError.message || 'Unable to open conversation.');
        }
      }
    }

    openConversation();

    return () => {
      active = false;
    };
  }, [selectedConversation?.id, currentUserId, loadConversations]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return conversations;

    return conversations.filter(conversation => {
      const title = conversation.title || '';
      const preview = conversation.last_message_preview || '';

      const participantNames = (conversation.participants || [])
        .map(item => item.profile?.full_name || item.profile?.email || '')
        .join(' ');

      return `${title} ${preview} ${participantNames}`
        .toLowerCase()
        .includes(term);
    });
  }, [conversations, search]);

  const unreadTotal = conversations.reduce(
    (total, conversation) => total + (conversation.unread_count || 0),
    0
  );

  const selectedParticipants = selectedConversation?.participants || [];

  const conversationHeading = selectedConversation
    ? selectedConversation.title ||
      (selectedConversation.conversation_type === 'support'
        ? 'BlaQsWatch Support'
        : selectedParticipants
            .filter(item => item.user_id !== currentUserId)
            .map(item => item.profile?.full_name || 'Company member')
            .join(', ') || 'Company conversation')
    : '';

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!draft.trim() || !selectedConversation || sending) return;

    setSending(true);
    setError('');

    try {
      await sendMessage({
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        content: draft
      });

      setDraft('');

      await Promise.all([
        loadMessages(selectedConversation.id),
        loadConversations()
      ]);

      await markConversationRead(
        selectedConversation.id,
        currentUserId
      );
    } catch (sendError) {
      console.error('Message send failed:', sendError);
      setError(sendError.message || 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }

  async function handleCreateConversation(event) {
    event.preventDefault();

    if (creating) return;

    if (!newMessage.trim()) {
      setError('Enter the first message to start the conversation.');
      return;
    }

    if (newType === 'internal' && selectedMembers.length === 0) {
      setError('Select at least one company member.');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const conversation = await createConversation({
        businessId: selectedBusinessId,
        creatorId: currentUserId,
        type: newType,
        title: newTitle,
        participantIds:
          newType === 'internal' ? selectedMembers : [],
        initialMessage: newMessage
      });

      const refreshed = await getConversationList({
        businessId: selectedBusinessId,
        currentUserId
      });

      setConversations(refreshed);

      const created = refreshed.find(
        item => item.id === conversation.id
      );

      setSelectedConversation(created || conversation);

      setShowNewConversation(false);
      setNewTitle('');
      setNewMessage('');
      setSelectedMembers([]);
      setNewType('internal');
    } catch (createError) {
      console.error('Conversation creation failed:', createError);
      setError(
        createError.message || 'Unable to create the conversation.'
      );
    } finally {
      setCreating(false);
    }
  }

  function toggleMember(memberId) {
    setSelectedMembers(current =>
      current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : [...current, memberId]
    );
  }

  if (workspaceLoading || loading) {
    return (
      <div className="messages-loading">
        <ArrowPathIcon />
        <span>Loading messages...</span>
      </div>
    );
  }

  return (
    <section className="messages-page">
      <div className="messages-heading">
        <div>
          <span className="messages-eyebrow">COMMUNICATION</span>
          <h1>Messages</h1>
          <p>
            Communicate with your team and BlaQsWatch support.
          </p>
        </div>

        <button
          type="button"
          className="messages-primary-button"
          onClick={() => {
            setError('');
            setShowNewConversation(value => !value);
          }}
        >
          <PlusIcon />
          New conversation
        </button>
      </div>

      {error && (
        <div className="messages-error" role="alert">
          {error}
        </div>
      )}

      {showNewConversation && (
        <form
          className="messages-compose-panel"
          onSubmit={handleCreateConversation}
        >
          <div className="messages-compose-heading">
            <div>
              <strong>Start a conversation</strong>
              <p>Choose who you want to contact.</p>
            </div>

            <button
              type="button"
              className="messages-text-button"
              onClick={() => setShowNewConversation(false)}
            >
              Cancel
            </button>
          </div>

          <div className="messages-type-options">
            <button
              type="button"
              className={newType === 'internal' ? 'selected' : ''}
              onClick={() => setNewType('internal')}
            >
              <UserGroupIcon />
              Company conversation
            </button>

            <button
              type="button"
              className={newType === 'support' ? 'selected' : ''}
              onClick={() => setNewType('support')}
            >
              <LifebuoyIcon />
              BlaQsWatch support
            </button>
          </div>

          {newType === 'internal' && (
            <>
              <label className="messages-field">
                Conversation title
                <input
                  value={newTitle}
                  onChange={event => setNewTitle(event.target.value)}
                  placeholder="e.g. Stock control team"
                  maxLength={120}
                />
              </label>

              <div className="messages-member-picker">
                <span>Select company members</span>

                {members.length === 0 ? (
                  <p>No other active company members were found.</p>
                ) : (
                  <div className="messages-member-list">
                    {members.map(member => (
                      <label key={member.id}>
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => toggleMember(member.id)}
                        />

                        <span>
                          <strong>
                            {member.full_name || member.email}
                          </strong>
                          <small>
                            {member.membershipRole}
                          </small>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {newType === 'support' && (
            <label className="messages-field">
              Subject
              <input
                value={newTitle}
                onChange={event => setNewTitle(event.target.value)}
                placeholder="What do you need help with?"
                maxLength={120}
              />
            </label>
          )}

          <label className="messages-field">
            First message
            <textarea
              value={newMessage}
              onChange={event => setNewMessage(event.target.value)}
              placeholder="Write your message..."
              rows={3}
              maxLength={10000}
              required
            />
          </label>

          <button
            type="submit"
            className="messages-primary-button"
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Start conversation'}
          </button>
        </form>
      )}

      <div className="messages-workspace">
        <aside className="messages-inbox">
          <div className="messages-inbox-heading">
            <div>
              <strong>Inbox</strong>
              <small>
                {conversations.length} conversations
                {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ''}
              </small>
            </div>
          </div>

          <div className="messages-search">
            <MagnifyingGlassIcon />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search conversations"
            />
          </div>

          <div className="messages-conversation-list">
            {filteredConversations.length === 0 ? (
              <div className="messages-empty-list">
                <ChatBubbleLeftRightIcon />
                <strong>No conversations yet</strong>
                <span>Start a conversation with your team or support.</span>
              </div>
            ) : (
              filteredConversations.map(conversation => {
                const isSelected =
                  selectedConversation?.id === conversation.id;

                const otherParticipants = (
                  conversation.participants || []
                )
                  .filter(item => item.user_id !== currentUserId)
                  .map(item =>
                    item.profile?.full_name ||
                    item.profile?.email ||
                    'Company member'
                  );

                const title =
                  conversation.title ||
                  (conversation.conversation_type === 'support'
                    ? 'BlaQsWatch Support'
                    : otherParticipants.join(', ') ||
                      'Company conversation');

                return (
                  <button
                    type="button"
                    key={conversation.id}
                    className={`messages-conversation-item ${
                      isSelected ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedConversation(conversation)}
                  >
                    <div className="messages-conversation-avatar">
                      {conversation.conversation_type === 'support'
                        ? <LifebuoyIcon />
                        : <UserGroupIcon />}
                    </div>

                    <div className="messages-conversation-info">
                      <div className="messages-conversation-topline">
                        <strong>{title}</strong>
                        <small>
                          {formatConversationDate(
                            conversation.last_message_at ||
                            conversation.created_at
                          )}
                        </small>
                      </div>

                      <p>
                        {conversation.last_message_preview ||
                          'No messages yet'}
                      </p>

                      <div className="messages-conversation-bottomline">
                        <span>
                          {conversation.conversation_type === 'support'
                            ? 'BlaQsWatch support'
                            : 'Company'}
                        </span>

                        {conversation.unread_count > 0 && (
                          <b>{conversation.unread_count}</b>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="messages-chat">
          {!selectedConversation ? (
            <div className="messages-chat-empty">
              <div className="messages-empty-icon">
                <ChatBubbleLeftRightIcon />
              </div>
              <h2>Your conversations</h2>
              <p>
                Select a conversation to read messages, or start a new one.
              </p>
            </div>
          ) : (
            <>
              <header className="messages-chat-header">
                <div className="messages-conversation-avatar">
                  {selectedConversation.conversation_type === 'support'
                    ? <LifebuoyIcon />
                    : <UserGroupIcon />}
                </div>

                <div>
                  <strong>{conversationHeading}</strong>
                  <small>
                    {selectedConversation.conversation_type === 'support'
                      ? 'BlaQsWatch support'
                      : `${selectedParticipants.length} participant(s)`}
                  </small>
                </div>
              </header>

              <div className="messages-chat-history">
                {messagesLoading ? (
                  <div className="messages-loading">
                    <ArrowPathIcon />
                    <span>Loading conversation...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="messages-chat-empty">
                    <p>No messages in this conversation yet.</p>
                  </div>
                ) : (
                  messages.map(message => {
                    const ownMessage =
                      message.sender_id === currentUserId;

                    return (
                      <div
                        key={message.id}
                        className={`messages-message-row ${
                          ownMessage ? 'own' : ''
                        }`}
                      >
                        <div className="messages-message">
                          {!ownMessage && (
                            <strong>
                              {message.sender?.full_name ||
                                message.sender?.email ||
                                'User'}
                            </strong>
                          )}

                          <p>{message.content}</p>

                          <small>
                            {formatTime(message.created_at)}
                          </small>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form
                className="messages-reply"
                onSubmit={handleSendMessage}
              >
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder="Write a message..."
                  rows={2}
                  maxLength={10000}
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />

                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Send message"
                  title="Send message"
                >
                  <PaperAirplaneIcon />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
