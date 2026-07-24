const fs = require('fs');
let lines = fs.readFileSync('src/pages/Chat.tsx', 'utf8').split('\n');

const startIndex = lines.findIndex(l => l.includes('Add participant'));
const endIndex = lines.findIndex((l, i) => i > startIndex && l.includes(': undefined}'));

console.log('Found:', startIndex, endIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `                          Add participant
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onClick={() => setShowContactInfo(true)}>
                        Contact info
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectionMode(true)}>
                        Select Messages
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowDisappearingSettings(true)}>
                        Disappearing Messages
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowAIFeatures(true)}>
                        AI features
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )}
          </div>

          {showMessageSearch && (
            <div className="border-b border-black/[0.05] bg-white px-3 py-2">
              <MessageSearchBar
                messages={displayMessages}
                onResultSelect={(messageId) => {
                  setSearchResultMessageId(messageId);
                  setShowMessageSearch(false);
                  toast.success('Message found - scrolling to message');
                }}
                onClose={() => setShowMessageSearch(false)}
              />
            </div>
          )}

          {isSomeoneTyping && (
            <div className="border-b border-black/[0.04] bg-white/70 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
              {otherUser?.username || 'Someone'} is typing...
            </div>
          )}

          <div className={\`min-h-0 flex-1 overflow-y-auto overflow-x-hidden \${wallpaperClass}\`}>
            {user?.id ? (
              <TrueVirtualMessageList
                messages={displayMessages}
                userId={user.id}
                otherUser={otherUser}
                onLoadMore={loadOlderMessages}
                hasMore={hasMore}
                isLoading={messagesLoading}
                onForward={handleForwardMessage}
                onStar={handleStarMessage}
                onReply={handleReplyMessage}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                onPin={handlePinMessage}
                onReport={handleReportMessage}
                selectionMode={selectionMode}
                selectedMessages={selectedMessages}
                onSelectMessage={handleSelectMessage}
                currentUser={{
                  username: currentUserProfile?.username || user.user_metadata?.username || user.email || 'Me',
                  avatar_url: currentUserProfile?.avatar_url || user.user_metadata?.avatar_url
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-2 border-primary/60 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          <div
            className="shrink-0 border-t border-black/[0.05] bg-white/96 px-3 pt-2 backdrop-blur-2xl"
            style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
          >
            <WhatsAppStyleInput
              onSendMessage={handleSendMessage}
              conversationId={activeConversationId}
              userId={user.id}
              disabled={messagesLoading}
              replyToMessage={replyToMessage}
              onCancelReply={cancelReply}
              lastMessage={displayMessages.length > 0 && displayMessages[displayMessages.length - 1].sender_id !== user.id 
                ? displayMessages[displayMessages.length - 1].content 
                : undefined}`;

  lines.splice(startIndex, endIndex - startIndex + 1, replacement);
  fs.writeFileSync('src/pages/Chat.tsx', lines.join('\n'));
  console.log('Fixed exactly using splice!');
}
